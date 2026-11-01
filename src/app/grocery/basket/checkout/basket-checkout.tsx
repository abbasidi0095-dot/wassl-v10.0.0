"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  CheckCircle2,
  Loader2,
  LocateFixed,
  MapPin,
  ShieldCheck,
  ShoppingBasket,
} from "lucide-react";
import {
  basketTotals,
  groupBasket,
  parseBasket,
  type BasketLine,
} from "@/lib/basket";
import { money } from "@/lib/utils";
import { useI18n } from "@/components/locale-provider";
import { MapView } from "@/components/map-view";

const BASKET_KEY = "wassl_basket_v1";
const BASKET_ID_KEY = "wassl_basket_id";

type OrderResult = {
  id: string;
  code: string;
  storeName: string;
  total: number;
};

type StoreError = { storeName: string; error: string };

type SavedAddress = {
  id: string;
  name: string;
  phone: string;
  address: string;
  landmark: string;
  lat: number;
  lng: number;
};

export function BasketCheckout() {
  const { t } = useI18n();
  const [lines, setLines] = useState<BasketLine[]>([]);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [landmark, setLandmark] = useState("");
  const [notes, setNotes] = useState("");
  const [pin, setPin] = useState({ lat: 23.6848, lng: -15.958 });
  const [locating, setLocating] = useState(false);
  const [pinError, setPinError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [orders, setOrders] = useState<OrderResult[]>([]);
  const [storeErrors, setStoreErrors] = useState<StoreError[]>([]);
  const prefill = useRef(false);

  useEffect(() => {
    try {
      const parsed = parseBasket(
        JSON.parse(window.localStorage.getItem(BASKET_KEY) || "[]"),
      );
      setLines(parsed);
      if (parsed[0]) {
        setPin({
          lat: parsed[0].storeLat || 23.6848,
          lng: parsed[0].storeLng || -15.958,
        });
      }
    } catch {
      // Ignore malformed storage.
    }
    setReady(true);
    let token = "";
    try {
      token = window.localStorage.getItem("wassl_customer_token") || "";
      if (!token) {
        token =
          window.crypto?.randomUUID?.() ??
          `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        window.localStorage.setItem("wassl_customer_token", token);
      }
    } catch {
      token = "";
    }
    if (!token) return;
    let active = true;
    fetch(`/api/addresses?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { addresses: [] }))
      .then((data: { addresses?: SavedAddress[] }) => {
        if (!active || prefill.current) return;
        const first = data.addresses?.[0];
        if (!first) return;
        prefill.current = true;
        setName((current) => current || first.name);
        setPhone((current) => current || first.phone);
        setAddress((current) => current || first.address);
        setLandmark((current) => current || first.landmark);
        setPin({ lat: first.lat, lng: first.lng });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const groups = useMemo(() => groupBasket(lines), [lines]);
  const totals = useMemo(() => basketTotals(groups), [groups]);
  const points = useMemo(
    () => [
      ...groups.map((group) => ({
        id: group.storeId,
        lat: group.lines[0]?.storeLat ?? 23.6848,
        lng: group.lines[0]?.storeLng ?? -15.958,
        kind: "store" as const,
        label: group.storeName,
      })),
      {
        id: "customer",
        lat: pin.lat,
        lng: pin.lng,
        kind: "customer" as const,
        label: t("Delivery pin"),
      },
    ],
    [groups, pin, t],
  );

  function useMyLocation() {
    if (!navigator.geolocation) {
      setPinError(t("Location is not available in this browser."));
      return;
    }
    setLocating(true);
    setPinError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPin({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocating(false);
      },
      () => {
        setPinError(t("Location permission was denied. Move the pin manually."));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!groups.length) return;
    if (totals.belowMinimum) {
      setError(t("Meet every store’s minimum before placing the orders."));
      return;
    }
    setLoading(true);
    setError("");
    setOrders([]);
    setStoreErrors([]);

    let basketId = "";
    try {
      basketId = window.localStorage.getItem(BASKET_ID_KEY) || "";
      if (!basketId) {
        basketId =
          window.crypto?.randomUUID?.() ??
          `basket-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        window.localStorage.setItem(BASKET_ID_KEY, basketId);
      }
    } catch {
      basketId = `basket-${Date.now()}`;
    }

    const created: OrderResult[] = [];
    const failed: StoreError[] = [];
    const createdStoreIds = new Set<string>();

    for (const group of groups) {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          citySlug: group.citySlug,
          storeId: group.storeId,
          customerName: name,
          customerPhone: phone,
          customerEmail: email.trim() || undefined,
          address,
          landmark,
          notes,
          lat: pin.lat,
          lng: pin.lng,
          substitutionPreference: group.substitution,
          idempotencyKey: `${basketId}:${group.storeId}`,
          items: group.lines.map((line) => ({
            productId: line.productId,
            qty: line.qty,
          })),
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        order?: { id: string; code: string; total: number };
      };
      if (!response.ok || !data.order) {
        failed.push({
          storeName: group.storeName,
          error: data.error || t("Could not place this store’s order."),
        });
        continue;
      }
      created.push({
        id: data.order.id,
        code: data.order.code,
        storeName: group.storeName,
        total: data.order.total,
      });
      createdStoreIds.add(group.storeId);
    }

    setOrders(created);
    setStoreErrors(failed);
    setLoading(false);

    if (created.length) {
      try {
        const existing = JSON.parse(
          window.localStorage.getItem("wassl_orders") || "[]",
        ) as string[];
        window.localStorage.setItem(
          "wassl_orders",
          JSON.stringify(
            [...created.map((order) => order.id), ...existing]
              .filter((id, index, all) => all.indexOf(id) === index)
              .slice(0, 40),
          ),
        );
      } catch {
        // Order history is a convenience.
      }
    }

    const remaining = lines.filter((line) => !createdStoreIds.has(line.storeId));
    setLines(remaining);
    try {
      window.localStorage.setItem(BASKET_KEY, JSON.stringify(remaining));
      if (!remaining.length) window.localStorage.removeItem(BASKET_ID_KEY);
    } catch {
      // Ignore storage errors.
    }
  }

  if (!ready) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-muted">
        <Loader2 size={14} className="animate-spin" /> {t("Loading basket…")}
      </div>
    );
  }

  if (!lines.length && orders.length) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-[10px] border border-success/30 bg-success-soft p-6">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-success">
            <CheckCircle2 size={18} /> {t("Orders created")}
          </div>
          <p className="mt-2 text-[12px] leading-6 text-muted">
            {t(
              "Each store accepted its own order. Pay each driver in cash and use each order’s handover code.",
            )}
          </p>
          <ul className="mt-4 space-y-2">
            {orders.map((order) => (
              <li
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] bg-surface px-3 py-2 text-[12px]"
              >
                <span>
                  <strong>{order.storeName}</strong> · {order.code}
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-semibold tnum">{money(order.total)}</span>
                  <Link href={`/orders/${order.id}`} className="font-medium text-brand">
                    {t("Track")}
                  </Link>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/orders" className="btn btn-primary btn-sm">
              {t("View order history")} <ArrowRight size={13} />
            </Link>
            <Link href="/grocery/basket" className="btn btn-ghost btn-sm">
              {t("Start another basket")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!lines.length && !orders.length) {
    return (
      <div className="mx-auto max-w-xl rounded-[10px] border border-dashed border-line px-6 py-16 text-center">
        <ShoppingBasket size={24} className="mx-auto text-muted" />
        <h1 className="mt-4 font-display text-[26px] font-semibold tracking-[-0.03em]">
          {t("Your basket is empty")}
        </h1>
        <p className="mt-2 text-[13px] leading-6 text-muted">
          {t("Build a basket across stores, then return here to split the checkout.")}
        </p>
        <Link href="/grocery/basket" className="btn btn-primary mt-5">
          {t("Open Wassl Basket")} <ArrowRight size={14} />
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr] lg:items-start">
      <div>
        <Link
          href="/grocery/basket"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted hover:text-ink"
        >
          <ArrowLeft size={12} className="rtl:-scale-x-100" /> {t("Back to basket")}
        </Link>
        <h1 className="display mt-3 text-[clamp(2rem,1.5rem+2.4vw,3.2rem)]">
          {t("Split checkout")}
        </h1>
        <p className="mt-2 max-w-[58ch] text-[13px] leading-6 text-muted">
          {t(
            "One delivery address, separate orders. Each store confirms, prepares and dispatches independently.",
          )}
        </p>

        {orders.length ? (
          <section className="mt-6 rounded-[10px] border border-success/30 bg-success-soft p-5">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-success">
              <CheckCircle2 size={16} /> {t("Orders created")}
            </div>
            <ul className="mt-3 space-y-2">
              {orders.map((order) => (
                <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
                  <span>
                    <strong>{order.storeName}</strong> · {order.code}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-semibold tnum">{money(order.total)}</span>
                    <Link href={`/orders/${order.id}`} className="font-medium text-brand">
                      {t("Track")}
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-muted">
              {t("Pay each driver in cash and use each order’s own handover code.")}
            </p>
          </section>
        ) : null}

        {storeErrors.length ? (
          <section className="mt-4 rounded-[8px] border border-danger/30 bg-danger-soft p-4">
            <div className="text-[12px] font-semibold text-danger">
              {t("Some stores could not accept the order")}
            </div>
            <ul className="mt-2 space-y-1 text-[11px] text-danger">
              {storeErrors.map((entry) => (
                <li key={entry.storeName}>
                  <strong>{entry.storeName}</strong>: {entry.error}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-muted">
              {t("Those items stay in your basket so you can fix them and retry.")}
            </p>
          </section>
        ) : null}

        <form onSubmit={submit} className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label">{t("Full name")}</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="input"
                required
              />
            </label>
            <label className="block">
              <span className="label">{t("Phone number")}</span>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="input"
                inputMode="tel"
                required
              />
            </label>
          </div>
          <label className="block">
            <span className="label">{t("Email (optional)")}</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="input"
              type="email"
            />
          </label>
          <label className="block">
            <span className="label">{t("Address")}</span>
            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              className="input"
              required
            />
          </label>
          <label className="block">
            <span className="label">{t("Landmark · repère")}</span>
            <input
              value={landmark}
              onChange={(event) => setLandmark(event.target.value)}
              className="input"
              required
            />
          </label>
          <label className="block">
            <span className="label">{t("Notes")}</span>
            <input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="input"
            />
          </label>

          <div className="rounded-[8px] border border-line p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[12px] font-semibold">{t("Delivery pin")}</div>
              <button
                type="button"
                onClick={useMyLocation}
                disabled={locating}
                className="btn btn-ghost btn-sm"
              >
                {locating ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <LocateFixed size={12} />
                )}
                {t("Use my location")}
              </button>
            </div>
            <div className="mt-3 overflow-hidden rounded-[6px]">
              <MapView points={points} center={pin} zoom={13} height={280} />
            </div>
            {pinError ? (
              <p className="mt-2 text-[11px] text-danger">{pinError}</p>
            ) : null}
          </div>

          {error ? (
            <p className="rounded-[6px] bg-danger-soft px-3 py-2 text-[12px] font-medium text-danger">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading || !groups.length || totals.belowMinimum}
            className="btn btn-primary w-full disabled:opacity-40"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Banknote size={14} />}
            {loading
              ? t("Creating {count} orders…", { count: groups.length })
              : t("Create {count} cash orders", { count: groups.length })}
          </button>
          <p className="text-center text-[10px] text-muted">
            {t("Cash only. No card is charged on Wassl.")}
          </p>
        </form>
      </div>

      <aside className="aero-tile rounded-[10px] border p-5 lg:sticky lg:top-24">
        <h2 className="font-display text-[20px] font-semibold tracking-[-0.02em]">
          {t("Order summary")}
        </h2>
        <div className="mt-3 space-y-3">
          {groups.map((group) => (
            <div key={group.storeId} className="border-b border-line pb-3 last:border-0 last:pb-0">
              <div className="flex items-center justify-between gap-2 text-[12px] font-semibold">
                <span>{group.storeName}</span>
                <span className="tnum">{money(group.total)}</span>
              </div>
              <div className="mt-1 text-[10px] text-muted">
                {group.itemCount} {t("items")} · {t("delivery")} {money(group.deliveryFee)}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-2 border-t border-line pt-3 text-[12px]">
          <div className="flex justify-between text-muted">
            <span>{t("Goods")}</span>
            <span className="font-medium text-ink tnum">{money(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>{t("Delivery")}</span>
            <span className="font-medium text-ink tnum">{money(totals.delivery)}</span>
          </div>
          <div className="flex justify-between text-[15px] font-semibold">
            <span>{t("Total")}</span>
            <span className="tnum">{money(totals.total)}</span>
          </div>
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-[6px] bg-surface-2 px-3 py-2 text-[11px] text-muted">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-brand" />
          {t("Each order keeps its own handover code. Drivers never see it.")}
        </div>
        <div className="mt-2 flex items-start gap-2 rounded-[6px] bg-surface-2 px-3 py-2 text-[11px] text-muted">
          <MapPin size={14} className="mt-0.5 shrink-0 text-brand" />
          {t("One pin is shared by every store in this basket.")}
        </div>
      </aside>
    </div>
  );
}
