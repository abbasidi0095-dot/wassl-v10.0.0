"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Loader2,
  MapPin,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  Truck,
} from "lucide-react";
import type {
  GrocerySettings,
  Store,
} from "@/lib/types";
import type { GroceryAvailability } from "@/lib/grocery";
import { groceryFees, haversineKm } from "@/lib/grocery";
import { quotePromo, type PromoQuote } from "@/lib/promos";
import { useCart } from "@/components/cart-provider";
import { useI18n } from "@/components/locale-provider";
import { MapView } from "@/components/map-view";
import { money } from "@/lib/utils";

type StorePayload = {
  store: Store;
  settings: GrocerySettings;
  availability: GroceryAvailability;
};

function casablancaMinutes() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Casablanca",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

export function GroceryCheckout() {
  const router = useRouter();
  const { t } = useI18n();
  const {
    items,
    ready,
    subtotal,
    storeSlug,
    storeCategory,
    clear,
  } = useCart();
  const [data, setData] = useState<StorePayload | null>(null);
  const [account, setAccount] = useState<{ loyaltyPoints: number }>({
    loyaltyPoints: 0,
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const idempotencyKey = useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const [error, setError] = useState("");

  const [fulfillment, setFulfillment] = useState<"delivery" | "pickup">("delivery");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [landmark, setLandmark] = useState("");
  const [pin, setPin] = useState({ lat: 23.6848, lng: -15.958 });
  const [express, setExpress] = useState(false);
  const [windowSlot, setWindowSlot] = useState("");
  const [substitution, setSubstitution] = useState<"allow" | "refund" | "contact">(
    "allow",
  );
  const [promoCode, setPromoCode] = useState("");
  const [promo, setPromo] = useState<PromoQuote | null>(null);
  const [promoError, setPromoError] = useState("");
  const [pointsToUse, setPointsToUse] = useState(0);

  useEffect(() => {
    if (!storeSlug) {
      setLoading(false);
      return;
    }
    let active = true;
    Promise.all([
      fetch(`/api/grocery/store?slug=${encodeURIComponent(storeSlug)}`, {
        cache: "no-store",
      }).then((response) => (response.ok ? response.json() : null)),
      fetch("/api/grocery/account", { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null),
    ])
      .then(([storeData, accountData]) => {
        if (!active) return;
        if (storeData) {
          const payload = storeData as StorePayload;
          setData(payload);
          setPin({ lat: payload.store.lat + 0.004, lng: payload.store.lng + 0.004 });
          setSubstitution(payload.settings.substitutionDefault);
          if (!payload.availability.delivery && payload.availability.pickup) {
            setFulfillment("pickup");
          }
        }
        if (accountData) setAccount(accountData as { loyaltyPoints: number });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [storeSlug]);

  const store = data?.store;
  const settings = data?.settings;
  const availability = data?.availability;

  const distance = useMemo(
    () =>
      store
        ? haversineKm({ lat: store.lat, lng: store.lng }, pin)
        : 0,
    [store, pin],
  );
  const delivery = useMemo(
    () =>
      store
        ? groceryFees({
            store,
            distanceKm: distance,
            express,
          })
        : null,
    [store, distance, express],
  );
  const fee = fulfillment === "pickup" ? 0 : delivery?.deliveryFee ?? 0;
  const minimum =
    fulfillment === "pickup"
      ? store?.minOrder ?? 0
      : delivery?.minOrder ?? store?.minOrder ?? 0;
  const promoDiscount = promo && !promo.freeDelivery ? promo.discount : 0;
  const freeDelivery = Boolean(promo?.freeDelivery);
  const effectiveFee = freeDelivery ? 0 : fee;
  const maxLoyaltyPoints = Math.min(
    account.loyaltyPoints,
    Math.floor(subtotal * 0.5 * 10),
  );
  const usablePoints =
    Math.floor(Math.min(pointsToUse, maxLoyaltyPoints) / 100) * 100;
  const loyaltyDiscount = usablePoints / 10;
  const total = Math.max(
    0,
    subtotal + effectiveFee - promoDiscount - loyaltyDiscount,
  );
  const belowMinimum = subtotal < minimum;
  const blocked =
    !availability ||
    !availability.open ||
    (fulfillment === "delivery" && (!availability.delivery || !delivery)) ||
    (fulfillment === "pickup" && !availability.pickup) ||
    (express && !availability.express);

  const slots = useMemo(() => {
    if (!settings) return [];
    const now = casablancaMinutes();
    return settings.scheduleSlots.filter((slot) => {
      const [hour, minute] = slot.split(":").map(Number);
      return hour * 60 + (minute || 0) > now + 15;
    });
  }, [settings]);

  function applyPromo() {
    if (!store) return;
    const result = quotePromo(promoCode, {
      subtotal,
      deliveryFee: fee,
      citySlug: store.citySlug,
    });
    if (result.ok) {
      setPromo(result.quote);
      setPromoError("");
    } else {
      setPromo(null);
      setPromoError(result.error);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!store || submitting || blocked) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          citySlug: store.citySlug,
          storeId: store.id,
          customerName: name,
          customerPhone: phone,
          customerEmail: email || undefined,
          address: fulfillment === "delivery" ? address : undefined,
          landmark: fulfillment === "delivery" ? landmark : undefined,
          lat: fulfillment === "delivery" ? pin.lat : store.lat,
          lng: fulfillment === "delivery" ? pin.lng : store.lng,
          fulfillment,
          express: fulfillment === "delivery" ? express : false,
          deliveryWindow: windowSlot || undefined,
          substitutionPreference: substitution,
          loyaltyPoints: usablePoints,
          promoCode: promo?.code,
          idempotencyKey: idempotencyKey.current,
          items: items.map((item) => ({
            productId: item.productId,
            qty: item.qty,
            variantId: item.variantId,
          })),
        }),
      });
      const result = (await response.json()) as {
        order?: { id: string };
        error?: string;
      };
      if (!response.ok || !result.order) {
        setError(result.error || t("Could not place the order"));
        return;
      }
      clear();
      router.push(`/orders/${result.order.id}`);
    } catch {
      setError(t("Could not reach Wassl. Check your connection and try again."));
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready || loading) {
    return <div className="card mt-6 h-64 animate-pulse" />;
  }

  if (!items.length || storeCategory !== "grocery" || !store) {
    return (
      <div className="card mt-6 grid place-items-center px-6 py-16 text-center">
        <ShoppingBasket size={28} className="text-teal" />
        <h2 className="mt-3 text-xl font-extrabold">{t("Your grocery cart is empty")}</h2>
        <p className="mt-1 text-sm text-ink/45">
          {t("Add products from a supermarket before checking out.")}
        </p>
        <Link href="/grocery" className="btn btn-primary mt-5">
          {t("Browse groceries")} <ArrowRight size={14} className="rtl:-scale-x-100" />
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 grid gap-5 lg:grid-cols-[1fr_380px] lg:items-start">
      <div className="space-y-4">
        <section className="card p-5">
          <div className="flex flex-wrap gap-2">
            {(["delivery", "pickup"] as const).map((mode) => {
              const enabled =
                mode === "delivery" ? availability?.delivery : availability?.pickup;
              return (
                <button
                  key={mode}
                  type="button"
                  disabled={!enabled}
                  onClick={() => setFulfillment(mode)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-extrabold transition ${
                    fulfillment === mode
                      ? "border-teal bg-teal/8 text-teal"
                      : "border-ink/10 text-ink/50"
                  } disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  {mode === "delivery" ? <Truck size={15} /> : <ShoppingBasket size={15} />}
                  {mode === "delivery" ? t("Delivery") : t("Pickup")}
                </button>
              );
            })}
          </div>

          {blocked ? (
            <p className="mt-3 rounded-xl bg-saffron/15 px-3 py-2 text-[11px] font-bold text-saffron-deep">
              {availability?.reason ||
                (fulfillment === "delivery" && !delivery
                  ? t("This address is outside the delivery zone.")
                  : t("This option is unavailable right now."))}
            </p>
          ) : null}

          {fulfillment === "delivery" ? (
            <div className="mt-4 overflow-hidden rounded-2xl">
              <MapView
                points={[
                  {
                    id: "store",
                    lat: store.lat,
                    lng: store.lng,
                    kind: "store",
                    label: store.name,
                  },
                  {
                    id: "customer",
                    lat: pin.lat,
                    lng: pin.lng,
                    kind: "customer",
                    label: t("Delivery pin"),
                  },
                ]}
                center={{ lat: pin.lat, lng: pin.lng }}
                zoom={14}
                height={220}
                onPick={(lat, lng) => setPin({ lat, lng })}
              />
            </div>
          ) : (
            <div className="mt-4 rounded-xl bg-cream p-3 text-xs font-bold text-ink/55">
              <div className="flex items-start gap-2">
                <MapPin size={14} className="mt-0.5 shrink-0 text-teal" />
                <span>
                  {store.name} · {store.address}
                  <br />
                  {t("Collect in about {min} minutes. Bring your pickup code.", {
                    min: store.prepTime,
                  })}
                </span>
              </div>
            </div>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label">{t("Full name")}</span>
              <input className="input" value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label className="block">
              <span className="label">{t("Phone number")}</span>
              <input className="input" value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" required />
            </label>
            <label className="block sm:col-span-2">
              <span className="label">{t("Email (optional)")}</span>
              <input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            {fulfillment === "delivery" ? (
              <>
                <label className="block sm:col-span-2">
                  <span className="label">{t("Address")}</span>
                  <input className="input" value={address} onChange={(event) => setAddress(event.target.value)} required />
                </label>
                <label className="block sm:col-span-2">
                  <span className="label">{t("Landmark")}</span>
                  <input className="input" value={landmark} onChange={(event) => setLandmark(event.target.value)} required />
                </label>
              </>
            ) : null}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="flex items-center gap-2 text-sm font-extrabold">
            <Clock3 size={15} className="text-teal" /> {t("When?")}
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setWindowSlot("");
                setExpress(false);
              }}
              className={`rounded-xl border p-3 text-start ${!windowSlot ? "border-teal bg-teal/8" : "border-ink/10"}`}
            >
              <div className="text-xs font-extrabold">{t("As soon as possible")}</div>
              <div className="mt-0.5 text-[10px] text-ink/40">
                {t("Usually {min}–{max} minutes", {
                  min: store.prepTime,
                  max: store.prepTime + 10,
                })}
              </div>
            </button>
            <label className={`rounded-xl border p-3 ${windowSlot ? "border-teal bg-teal/8" : "border-ink/10"}`}>
              <div className="text-xs font-extrabold">{t("Schedule for later")}</div>
              <select
                className="mt-1 w-full bg-transparent text-[10px] font-bold text-ink/55 outline-none"
                value={windowSlot}
                onChange={(event) => {
                  setWindowSlot(event.target.value);
                  setExpress(false);
                }}
                disabled={!availability?.scheduling}
              >
                <option value="">{t("Choose a window")}</option>
                {slots.map((slot) => (
                  <option key={slot} value={slot}>{slot}</option>
                ))}
              </select>
            </label>
          </div>

          {fulfillment === "delivery" ? (
            <label className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-cream p-3">
              <span className="flex items-center gap-2 text-xs font-extrabold">
                <Sparkles size={14} className="text-saffron" />
                {t("Express delivery")}
                <span className="text-[10px] font-bold text-ink/40">
                  +{money(settings?.expressFee ?? 0)} · {settings?.expressMinutes ?? 30} min
                </span>
              </span>
              <input
                type="checkbox"
                checked={express}
                onChange={(event) => {
                  setExpress(event.target.checked);
                  if (event.target.checked) setWindowSlot("");
                }}
                disabled={!availability?.express}
                className="h-4 w-4 accent-teal"
              />
            </label>
          ) : null}
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-extrabold">{t("Substitutions")}</h2>
          <p className="mt-1 text-[11px] text-ink/40">
            {t("Tell the store what to do if an item is out of stock.")}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {[
              { id: "allow" as const, label: t("Allow a similar item") },
              { id: "contact" as const, label: t("Call me first") },
              { id: "refund" as const, label: t("Remove & refund") },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setSubstitution(option.id)}
                className={`rounded-xl border p-3 text-xs font-extrabold ${
                  substitution === option.id
                    ? "border-teal bg-teal/8 text-teal"
                    : "border-ink/10 text-ink/50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>
      </div>

      <aside className="card p-5 lg:sticky lg:top-24">
        <h2 className="text-lg font-extrabold">{t("Order summary")}</h2>
        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pe-1">
          {items.map((item) => (
            <div key={item.lineId} className="flex items-start justify-between gap-2 text-xs">
              <div className="min-w-0">
                <div className="truncate font-extrabold">{item.name}</div>
                <div className="text-[10px] text-ink/40">
                  {item.variantLabel || item.unit || ""} · ×{item.qty}
                </div>
              </div>
              <div className="shrink-0 font-extrabold">{money(item.price * item.qty)}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 border-t border-ink/8 pt-3 text-xs">
          <div className="flex justify-between text-ink/50">
            <span>{t("Subtotal")}</span>
            <span className="font-extrabold text-ink">{money(subtotal)}</span>
          </div>
          <div className="mt-1 flex justify-between text-ink/50">
            <span>
              {fulfillment === "pickup" ? t("Pickup") : t("Delivery")}
              {delivery?.night ? ` · ${t("night")}` : ""}
            </span>
            <span className="font-extrabold text-ink">{money(effectiveFee)}</span>
          </div>
          {promoDiscount ? (
            <div className="mt-1 flex justify-between text-teal">
              <span>{promo?.code}</span>
              <span className="font-extrabold">−{money(promoDiscount)}</span>
            </div>
          ) : null}
          {loyaltyDiscount ? (
            <div className="mt-1 flex justify-between text-teal">
              <span>{t("Loyalty")}</span>
              <span className="font-extrabold">−{money(loyaltyDiscount)}</span>
            </div>
          ) : null}
          <div className="mt-2 flex justify-between border-t border-ink/8 pt-2 text-base font-extrabold">
            <span>{t("Total")}</span>
            <span>{money(total)}</span>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <input
            className="input h-9 text-[11px]"
            placeholder={t("Promo code")}
            value={promoCode}
            onChange={(event) => setPromoCode(event.target.value)}
          />
          <button type="button" onClick={applyPromo} className="btn btn-ghost btn-sm">
            {t("Apply")}
          </button>
        </div>
        {promoError ? <p className="mt-1 text-[10px] font-bold text-coral">{promoError}</p> : null}

        {account.loyaltyPoints > 0 ? (
          <label className="mt-3 block rounded-xl bg-cream p-3">
            <span className="flex items-center justify-between text-[10px] font-extrabold text-ink/55">
              {t("Use loyalty points")} · {account.loyaltyPoints}
              <span>{usablePoints} pts = {money(loyaltyDiscount)}</span>
            </span>
            <input
              type="range"
              min={0}
              max={maxLoyaltyPoints}
              step={100}
              value={pointsToUse}
              onChange={(event) => setPointsToUse(Number(event.target.value))}
              className="mt-2 w-full accent-teal"
            />
          </label>
        ) : null}

        <div className="mt-3 rounded-xl bg-saffron/15 p-3 text-[10px] font-bold text-ink/55">
          {fulfillment === "pickup"
            ? t("Pay the store in cash when you collect. Bring your pickup code.")
            : t("Pay the driver in cash when your order arrives.")}
        </div>

        {belowMinimum ? (
          <p className="mt-2 text-[10px] font-bold text-red-600">
            {t("Add {amount} more to reach the {minimum} minimum.", {
              amount: money(minimum - subtotal),
              minimum: money(minimum),
            })}
          </p>
        ) : null}
        {error ? <p className="mt-2 text-[10px] font-bold text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting || blocked || belowMinimum}
          className="btn btn-primary mt-4 w-full disabled:cursor-not-allowed disabled:opacity-45"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
          {submitting
            ? t("Placing order…")
            : `${fulfillment === "pickup" ? t("Place pickup order") : t("Place COD order")} · ${money(total)}`}
        </button>
        <p className="mt-2 flex items-center justify-center gap-1 text-[9px] font-bold text-ink/30">
          <CheckCircle2 size={10} /> {t("Stock reserved when you order")}
        </p>
      </aside>
    </form>
  );
}
