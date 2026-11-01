"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  Check,
  Loader2,
  Package,
  ScanBarcode,
  ShoppingBasket,
  Store as StoreIcon,
} from "lucide-react";
import type { Product, Store } from "@/lib/types";
import { addBasketLine, parseBasket, type BasketLine } from "@/lib/basket";
import { money } from "@/lib/utils";
import { useI18n } from "@/components/locale-provider";
import { ProductTile } from "@/components/product-icon";

const BASKET_KEY = "wassl_basket_v1";

type BarcodeDetectorLike = {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
};

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

export function BarcodeScanner() {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const detectingRef = useRef(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(false);
  const [detectorSupported, setDetectorSupported] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ product: Product; store: Store } | null>(null);
  const [added, setAdded] = useState("");
  const [addedLines, setAddedLines] = useState<BasketLine[]>([]);

  useEffect(() => {
    setCameraSupported(Boolean(navigator.mediaDevices?.getUserMedia));
    setDetectorSupported(
      "BarcodeDetector" in window &&
        Boolean((window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector),
    );
    try {
      setAddedLines(
        parseBasket(JSON.parse(window.localStorage.getItem(BASKET_KEY) || "[]")),
      );
    } catch {
      setAddedLines([]);
    }
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopCamera() {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }

  async function startCamera() {
    if (!cameraSupported) {
      setCameraError(t("The camera is not available in this browser. Enter the barcode manually."));
      return;
    }
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);

      const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
        .BarcodeDetector;
      if (!Detector) {
        setCameraError(
          t(
            "This browser can show the camera but cannot decode barcodes. Use manual entry.",
          ),
        );
        return;
      }
      const detector = new Detector({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39"],
      });
      timerRef.current = window.setInterval(async () => {
        if (detectingRef.current) return;
        const video = videoRef.current;
        if (!video || video.readyState < 2) return;
        detectingRef.current = true;
        try {
          const codes = await detector.detect(video);
          const raw = codes[0]?.rawValue;
          if (raw) {
            stopCamera();
            setManualCode(raw);
            void lookup(raw);
          }
        } catch {
          // A single failed frame should not stop scanning.
        } finally {
          detectingRef.current = false;
        }
      }, 350);
    } catch {
      setCameraError(t("Camera permission was denied. Enter the barcode manually."));
    }
  }

  async function lookup(value: string) {
    const code = value.trim();
    if (!code) {

      setError(t("Enter a barcode."));
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    setAdded("");
    try {
      const response = await fetch(
        `/api/grocery/barcode?code=${encodeURIComponent(code)}`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as {
        product?: Product;
        store?: Store;
        error?: string;
      };
      if (!response.ok || !data.product || !data.store) {
        setError(data.error || t("No grocery product matches that barcode."));
        return;
      }
      setResult({ product: data.product, store: data.store });
    } catch {
      setError(t("Could not look up that barcode. Try again."));
    } finally {
      setLoading(false);
    }
  }

  function addToBasket() {
    if (!result) return;
    const { product, store } = result;
    const stock = product.variants?.length
      ? product.variants.reduce((sum, variant) => sum + variant.stock, 0)
      : (product.stock ?? 0);
    if (!product.available || stock <= 0) {
      setError(t("This product is sold out."));
      return;
    }
    let current: BasketLine[] = [];
    try {
      current = parseBasket(JSON.parse(window.localStorage.getItem(BASKET_KEY) || "[]"));
    } catch {
      current = [];
    }
    if (current.length && current[0].citySlug !== store.citySlug) {
      setError(t("Finish or clear your basket before adding items from another city."));
      return;
    }
    const next = addBasketLine(current, {
      productId: product.id,
      storeId: store.id,
      storeSlug: store.slug,
      storeName: store.name,
      storeCategory: "grocery",
      citySlug: store.citySlug,
      storeLat: store.lat,
      storeLng: store.lng,
      name: product.name,
      image: product.image?.startsWith("data:") ? undefined : product.image,
      price: product.price,
      unit: product.unit,
      stock,
      deliveryFee: store.deliveryFee,
      minOrder: store.minOrder,
      substitution: "allow",
      barcode: product.barcode,
    });
    try {
      window.localStorage.setItem(BASKET_KEY, JSON.stringify(next));
    } catch {
      setError(t("Could not save the basket in this browser."));
      return;
    }
    setAddedLines(next);
    setAdded(product.name);
    setError("");
  }

  return (
    <div className="mx-auto max-w-[1040px]">
      <div className="border-b border-line pb-6">
        <div className="eyebrow">
          <ScanBarcode size={14} /> {t("Barcode scanner")}
        </div>
        <h1 className="display mt-2 text-[clamp(2.2rem,1.6rem+3vw,3.8rem)]">
          {t("Scan. Find. Add.")}
        </h1>
        <p className="mt-3 max-w-[60ch] text-[14px] leading-6 text-muted">
          {t(
            "Point the camera at a grocery barcode or type it. We match it to a real product and store, then add it to your basket.",
          )}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/grocery/basket" className="btn btn-ghost btn-sm">
            <ShoppingBasket size={13} /> {t("Open Wassl Basket")}
            {addedLines.length ? (
              <span className="ms-1 rounded-full bg-ink px-1.5 text-[10px] text-on-dark tnum">
                {addedLines.reduce((sum, line) => sum + line.qty, 0)}
              </span>
            ) : null}
          </Link>
          <Link href="/grocery" className="btn btn-ghost btn-sm">
            {t("Back to grocery")}
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <section className="aero-tile overflow-hidden rounded-[10px] border">
          <div className="relative aspect-[4/3] bg-ink">
            <video
              ref={videoRef}
              muted
              playsInline
              className={`h-full w-full object-cover ${cameraOn ? "opacity-100" : "opacity-0"}`}
            />
            {!cameraOn ? (
              <div className="absolute inset-0 grid place-items-center p-6 text-center text-on-dark">
                <div>
                  <Camera size={28} className="mx-auto text-on-dark/70" />
                  <p className="mt-3 max-w-[30ch] text-[12px] leading-5 text-on-dark/70">
                    {cameraSupported
                      ? t("Camera scanning stays on this device.")
                      : t("This browser has no camera API. Use manual entry.")}
                  </p>
                </div>
              </div>
            ) : (
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className="h-32 w-56 rounded-[8px] border-2 border-saffron/80 shadow-[0_0_0_999px_rgba(0,0,0,0.28)]" />
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-3">
            <div className="text-[11px] text-muted">
              {detectorSupported
                ? t("Point the barcode inside the frame.")
                : t("Live decoding is unavailable here. Manual entry works everywhere.")}
            </div>
            {cameraOn ? (
              <button type="button" onClick={stopCamera} className="btn btn-ghost btn-sm">
                <CameraOff size={12} /> {t("Stop camera")}
              </button>
            ) : (
              <button
                type="button"
                onClick={startCamera}
                disabled={!cameraSupported}
                className="btn btn-primary btn-sm disabled:opacity-40"
              >
                <Camera size={12} /> {t("Start camera")}
              </button>
            )}
          </div>
          {cameraError ? (
            <p className="border-t border-line px-3 py-2 text-[11px] text-muted">
              {cameraError}
            </p>
          ) : null}
        </section>

        <section className="aero-tile rounded-[10px] border p-5">
          <h2 className="text-[13px] font-semibold">{t("Enter a barcode")}</h2>
          <p className="mt-1 text-[11px] text-muted">
            {t("Find the number under the barcode. EAN and UPC codes work.")}
          </p>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void lookup(manualCode);
            }}
          >
            <input
              value={manualCode}
              onChange={(event) => setManualCode(event.target.value)}
              className="input h-10 flex-1 text-[14px] tracking-[0.08em]"
              placeholder="6111200000017"
              inputMode="numeric"
              aria-label={t("Barcode number")}
            />
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-sm shrink-0 disabled:opacity-40"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <ScanBarcode size={13} />}
              {t("Look up")}
            </button>
          </form>

          {error ? (
            <p className="mt-3 rounded-[6px] bg-danger-soft px-3 py-2 text-[11px] font-medium text-danger">
              {error}
            </p>
          ) : null}

          {added ? (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-[6px] bg-success-soft px-3 py-2 text-[11px] font-medium text-success">
              <Check size={12} /> {t("{name} added to your basket.", { name: added })}
            </p>
          ) : null}

          {result ? (
            <div className="mt-4 border-t border-line pt-4">
              <div className="flex items-start gap-3">
                <ProductTile
                  name={result.product.name}
                  category={result.product.category}
                  image={result.product.image}
                  className="h-16 w-16 shrink-0 rounded-[7px]"
                  iconSize={22}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold">{result.product.name}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
                    <StoreIcon size={11} /> {result.store.name}
                  </div>
                  <div className="mt-1 text-[12px] font-semibold tnum">
                    {money(result.product.price)}
                    {result.product.unit ? (
                      <span className="ms-1 font-normal text-muted">
                        / {result.product.unit}
                      </span>
                    ) : null}
                  </div>
                  {result.product.barcode ? (
                    <div className="mt-1 text-[10px] text-muted tnum">
                      {result.product.barcode}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={addToBasket}
                  className="btn btn-primary btn-sm"
                >
                  <ShoppingBasket size={13} /> {t("Add to basket")}
                </button>
                <Link
                  href={`/store/${result.store.slug}?product=${encodeURIComponent(result.product.id)}`}
                  className="btn btn-ghost btn-sm gap-1.5"
                >
                  <Package size={13} /> {t("View in store")}
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-[8px] border border-dashed border-line px-4 py-8 text-center">
              <ScanBarcode size={20} className="mx-auto text-muted" />
              <p className="mt-2 text-[12px] text-muted">
                {t("Scan or type a barcode to see the product.")}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
