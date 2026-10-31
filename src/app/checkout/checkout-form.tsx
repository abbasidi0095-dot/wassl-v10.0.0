"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  CheckCircle2,
  Clock3,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  ShoppingBag,
  Tag,
  X,
} from "lucide-react";
import { useCart } from "@/components/cart-provider";
import { MapView } from "@/components/map-view";
import { ProductTile } from "@/components/product-icon";
import { quotePromo, type PromoQuote } from "@/lib/promos";
import { money } from "@/lib/utils";
import { useI18n } from "@/components/locale-provider";

type SavedAddress = {
  id: string;
  label: string;
  name: string;
  phone: string;
  address: string;
  landmark: string;
  lat: number;
  lng: number;
  lastUsedAt: string;
};

export function CheckoutForm({
  initialName = "",
  initialPhone = "",
  initialEmail = "",
  lockEmail = false,
}: {
  initialName?: string;
  initialPhone?: string;
  initialEmail?: string;
  lockEmail?: boolean;
} = {}) {
  const router = useRouter();
  const { t } = useI18n();
  const { items, ready, subtotal, deliveryFee, minOrder, storeName, clear } = useCart();
  const store = items[0];
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [email, setEmail] = useState(initialEmail);
  const [address, setAddress] = useState("");
  const [landmark, setLandmark] = useState("");
  const [notes, setNotes] = useState("");
  const [scheduled, setScheduled] = useState("");
  const [pin, setPin] = useState({
    lat: store?.storeLat ?? 23.6848,
    lng: store?.storeLng ?? -15.958,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<PromoQuote | null>(null);
  const [promoError, setPromoError] = useState("");
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [addressToken, setAddressToken] = useState("");
  const prefilledAddress = useRef(false);
  const initialPin = useRef(pin);

  const promoResult = promo
    ? quotePromo(promo.code, {
        subtotal,
        deliveryFee,
        citySlug: store?.citySlug ?? "",
      })
    : null;
  const activePromo = promoResult?.ok ? promoResult.quote : null;
  const promoInvalid =
    promo && promoResult && !promoResult.ok ? promoResult.error : "";
  const effectiveDelivery = activePromo?.freeDelivery ? 0 : deliveryFee;
  const discount = activePromo?.discount ?? 0;
  const total = Math.max(0, subtotal + effectiveDelivery - discount);
  const belowMinimum = subtotal < (minOrder || 0);
  const points = useMemo(
    () => [
      ...(store
        ? [
            {
              id: "store",
              lat: store.storeLat,
              lng: store.storeLng,
              kind: "store" as const,
              label: store.storeName,
            },
          ]
        : []),
      { id: "customer", lat: pin.lat, lng: pin.lng, kind: "customer" as const, label: "Your delivery pin" },
    ],
    [store, pin],
  );

  useEffect(() => {
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
    setAddressToken(token);
    if (!token) return;

    let active = true;
    fetch(`/api/addresses?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { addresses: [] }))
      .then((data: { addresses?: SavedAddress[] }) => {
        if (!active) return;
        const list = data.addresses ?? [];
        setSavedAddresses(list);
        if (!prefilledAddress.current && list[0]) {
          prefilledAddress.current = true;
          prefillSavedAddress(list[0]);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  function applySavedAddress(entry: SavedAddress) {
    setName(entry.name);
    setPhone(entry.phone);
    setAddress(entry.address);
    setLandmark(entry.landmark);
    setPin({ lat: entry.lat, lng: entry.lng });
  }

  /** Auto-fill on load without overwriting anything the customer typed first. */
  function prefillSavedAddress(entry: SavedAddress) {
    setName((current) => current || entry.name);
    setPhone((current) => current || entry.phone);
    setAddress((current) => current || entry.address);
    setLandmark((current) => current || entry.landmark);
    setPin((current) =>
      current.lat === initialPin.current.lat && current.lng === initialPin.current.lng
        ? { lat: entry.lat, lng: entry.lng }
        : current,
    );
  }

  function removeSavedAddress(entry: SavedAddress) {
    setSavedAddresses((list) => list.filter((item) => item.id !== entry.id));
    if (!addressToken) return;
    void fetch(
      `/api/addresses?token=${encodeURIComponent(addressToken)}&id=${encodeURIComponent(entry.id)}`,
      { method: "DELETE" },
    ).catch(() => {});
  }

  function applyPromo() {
    const result = quotePromo(promoInput, {
      subtotal,
      deliveryFee,
      citySlug: store?.citySlug ?? "",
    });
    if (result.ok) {
      setPromo(result.quote);
      setPromoInput("");
      setPromoError("");
    } else {
      setPromo(null);
      setPromoError(result.error);
    }
  }

  function removePromo() {
    setPromo(null);
    setPromoError("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!store) return;
    setLoading(true);
    setError("");
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        citySlug: store.citySlug,
        storeId: store.storeId,
        customerName: name,
        customerPhone: phone,
        customerEmail: email.trim() || undefined,
        address,
        landmark,
        notes,
        lat: pin.lat,
        lng: pin.lng,
        scheduledFor: scheduled || undefined,
        promoCode: activePromo?.code,
        items: items.map((item) => ({
          productId: item.productId,
          qty: item.qty,
          optionIds: item.options.map((option) => option.optionId),
        })),
      }),
    });
    const data = (await response.json()) as { error?: string; order?: { id: string } };
    if (!response.ok || !data.order) {
      setError(data.error || "Could not place your order");
      setLoading(false);
      return;
    }
    try {
      const existing = JSON.parse(window.localStorage.getItem("wassl_orders") || "[]") as string[];
      window.localStorage.setItem(
        "wassl_orders",
        JSON.stringify([data.order.id, ...existing.filter((id) => id !== data.order!.id)].slice(0, 40)),
      );
    } catch {
      // local order history is a convenience only
    }
    if (addressToken) {
      void fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: addressToken,
          name,
          phone,
          address,
          landmark,
          lat: pin.lat,
          lng: pin.lng,
        }),
      }).catch(() => {});
    }
    clear();
    router.push(`/orders/${data.order.id}`);
  }

  if (!ready) return <div className="card mt-8 h-56 animate-pulse" />;

  if (!items.length) {
    return (
      <div className="card mt-8 grid place-items-center px-6 py-14 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-teal/10 text-teal"><ShoppingBag size={26} /></span>
        <h2 className="mt-3 text-2xl font-extrabold tracking-tight">{t("Nothing to check out")}</h2>
        <p className="mt-2 text-sm text-ink/45">{t("Add a few items from a local store first.")}</p>
        <Link href="/city/dakhla" className="btn btn-primary mt-5">
          {t("Browse stores")} <ArrowRight size={14} className="rtl:-scale-x-100" />
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-8 grid gap-5 lg:grid-cols-[1fr_370px] lg:items-start">
      <div className="space-y-4">
        <section className="card p-5">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-teal text-on-dark">
              <MapPin size={15} />
            </span>
            <div>
              <h2 className="text-sm font-extrabold">{t("Where should we deliver?")}</h2>
              <p className="text-[10px] font-bold text-ink/35">{t("Tap the map to move the pin.")}</p>
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl">
            <MapView
              points={points}
              center={{ lat: pin.lat, lng: pin.lng }}
              zoom={14}
              height={245}
              onPick={(lat, lng) => setPin({ lat, lng })}
            />
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-cream px-3 py-2 text-[10px] font-bold text-ink/45">
            <MapPin size={13} className="text-teal" />
            Pin: {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
            <span className="ms-auto hidden sm:block">{t("Tap anywhere on the map")}</span>
          </div>
        </section>

        <section className="card p-5">
          {savedAddresses.length ? (
            <div className="mb-4">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-ink/35">
                {t("Saved addresses")}
              </div>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {savedAddresses.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex shrink-0 items-stretch overflow-hidden rounded-2xl border border-ink/10 bg-white/60"
                  >
                    <button
                      type="button"
                      onClick={() => applySavedAddress(entry)}
                      className="px-3 py-2 text-start transition hover:bg-teal/6"
                    >
                      <span className="block text-[10px] font-extrabold text-teal">
                        {entry.label}
                      </span>
                      <span className="mt-0.5 block max-w-[160px] truncate text-[9px] font-bold text-ink/45">
                        {entry.landmark}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSavedAddress(entry)}
                      aria-label={`Remove ${entry.label}`}
                      className="grid w-8 place-items-center border-s border-ink/8 text-ink/30 hover:bg-red-50 hover:text-red-500"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label">{t("Full name")}</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="input"
                placeholder="Your name"
                required
              />
            </label>
            <label className="block">
              <span className="label">{t("Phone number")}</span>
              <div className="relative">
                <Phone
                  size={14}
                  className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink/30"
                />
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="input ps-9"
                  placeholder="+212 6…"
                  inputMode="tel"
                  required
                />
              </div>
            </label>
            <label className="block sm:col-span-2">
              <span className="label">
                Email{" "}
                <span className="font-normal text-ink/35">
                  {lockEmail ? t("(your account email · order updates)") : t("(optional · order updates)")}
                </span>
              </span>
              <div className="relative">
                <Mail
                  size={14}
                  className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink/30"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="input ps-9"
                  placeholder="you@example.com"
                  autoComplete="email"
                  readOnly={lockEmail}
                />
              </div>
            </label>
            <label className="block sm:col-span-2">
              <span className="label">{t("Address")}</span>
              <input
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                className="input"
                placeholder="Hay, street, building or villa number"
                required
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="label">{t("Landmark · repère")}</span>
              <input
                value={landmark}
                onChange={(event) => setLandmark(event.target.value)}
                className="input"
                placeholder="Near the mosque, behind the school…"
                required
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="label">{t("Notes for the driver (optional)")}</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="input min-h-20 resize-none"
                placeholder="Floor, colour of the door, call on arrival…"
              />
            </label>
          </div>
        </section>

        <section className="card p-5">
          <div className="flex items-center gap-2">
            <Clock3 size={16} className="text-teal" />
            <h2 className="text-sm font-extrabold">{t("When?")}</h2>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setScheduled("")}
              className={`rounded-2xl border p-3 text-start transition ${
                !scheduled ? "border-teal bg-teal/8" : "border-ink/10 bg-white/50"
              }`}
            >
              <div className="text-xs font-extrabold">{t("As soon as possible")}</div>
              <div className="mt-0.5 text-[10px] text-ink/40">{t("Usually 25–45 minutes")}</div>
            </button>
            <label
              className={`rounded-2xl border p-3 transition ${
                scheduled ? "border-teal bg-teal/8" : "border-ink/10 bg-white/50"
              }`}
            >
              <div className="text-xs font-extrabold">{t("Schedule for later")}</div>
              <input
                type="datetime-local"
                value={scheduled}
                onChange={(event) => setScheduled(event.target.value)}
                className="mt-1 w-full bg-transparent text-[10px] font-bold text-ink/50 outline-none"
              />
            </label>
          </div>
        </section>
      </div>

      <aside className="card p-5 lg:sticky lg:top-24">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold tracking-tight">{t("Your order")}</h2>
          <Link href="/cart" className="inline-flex items-center gap-1 text-[10px] font-extrabold text-teal">
            <ArrowLeft size={12} /> Edit
          </Link>
        </div>
        <div className="mt-2 text-[11px] font-bold text-ink/40">{storeName}</div>
        <div className="mt-4 max-h-56 space-y-2 overflow-y-auto pe-1">
          {items.map((item) => (
            <div key={item.lineId} className="flex items-center gap-2 text-[11px]">
              <ProductTile name={item.name} className="h-7 w-7 rounded-lg" iconSize={14} />
              <span className="min-w-0 flex-1 truncate font-bold text-ink/65">
                {item.qty}× {item.name}
                {item.options.length ? (
                  <span className="block truncate text-[9px] font-bold text-ink/35">
                    {item.options.map((option) => option.optionName).join(" · ")}
                  </span>
                ) : null}
              </span>
              <span className="font-extrabold">{money(item.price * item.qty)}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 border-t border-ink/8 pt-4">
          {activePromo ? (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-teal/8 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2 text-[11px] font-extrabold text-teal">
                <Tag size={13} />
                <span>{activePromo.code}</span>
                <span className="truncate font-bold text-ink/40">{activePromo.label}</span>
              </div>
              <button
                type="button"
                onClick={removePromo}
                className="shrink-0 text-[10px] font-extrabold text-ink/40 hover:text-red-500"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag
                  size={13}
                  className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink/30"
                />
                <input
                  value={promoInput}
                  onChange={(event) => setPromoInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      applyPromo();
                    }
                  }}
                  className="input h-10 ps-9 uppercase"
                  placeholder={t("Promo code")}
                  aria-label={t("Promo code")}
                />
              </div>
              <button type="button" onClick={applyPromo} className="btn btn-ghost btn-sm">
                Apply
              </button>
            </div>
          )}
          {promoError || promoInvalid ? (
            <p className="mt-1.5 text-[10px] font-bold text-red-600">
              {promoError || promoInvalid}
            </p>
          ) : null}
        </div>
        <div className="mt-4 space-y-2 border-t border-ink/8 pt-4 text-[12px]">
          <div className="flex justify-between text-ink/50">
            <span>{t("Subtotal")}</span>
            <span className="font-extrabold text-ink">{money(subtotal)}</span>
          </div>
          <div className="flex justify-between text-ink/50">
            <span>{t("Delivery")}</span>
            <span className="font-extrabold text-ink">
              {activePromo?.freeDelivery ? (
                <>
                  <s className="me-1 text-ink/30">{money(deliveryFee)}</s>
                  <span className="text-teal">{t("Free")}</span>
                </>
              ) : (
                money(deliveryFee)
              )}
            </span>
          </div>
          {discount > 0 ? (
            <div className="flex justify-between text-teal">
              <span>{t("Promo {code}", { code: activePromo?.code || "" })}</span>
              <span className="font-extrabold">−{money(discount)}</span>
            </div>
          ) : null}
          <div className="flex justify-between pt-1 text-base font-extrabold">
            <span>{t("Total")}</span>
            <span>{money(total)}</span>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-teal/8 p-3">
          <Banknote size={18} className="shrink-0 text-teal" />
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-teal">
              {t("Cash on delivery")}
            </div>
            <div className="mt-0.5 text-[10px] leading-4 text-ink/45">
              Pay {money(total)} to the driver.
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-ink/35">
          <ShieldCheck size={13} className="text-teal" />
          Your number is shared only with the driver.
        </div>

        {belowMinimum ? (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700">
            {t("This store has a {minimum} minimum order.", { minimum: money(minOrder) })}
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading || belowMinimum}
          className="btn btn-primary mt-4 w-full disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? t("Placing order…") : t("Place COD order · {price}", { price: money(total) })}
          {!loading ? <CheckCircle2 size={15} /> : null}
        </button>
        <p className="mt-3 text-center text-[9px] font-bold text-ink/30">
          No account needed · Confirm by phone if we need you
        </p>
      </aside>
    </form>
  );
}
