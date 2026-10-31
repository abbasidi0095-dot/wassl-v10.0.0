"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Banknote,
  Bike,
  CarTaxiFront,
  Clock3,
  MapPin,
  PackageCheck,
  ReceiptText,
  RotateCcw,
  Search,
} from "lucide-react";
import { useCart } from "@/components/cart-provider";
import { STATUS_META, type OrderStatus, type SelectedModifier, type TaxiRide } from "@/lib/types";
import { TAXI_STATUS_TEXT } from "@/lib/taxi-status";
import { useI18n } from "@/components/locale-provider";
import { money, timeAgo } from "@/lib/utils";

type SummaryLine = {
  productId: string;
  name: string;
  emoji: string;
  image?: string;
  price: number;
  qty: number;
  options: SelectedModifier[];
};

type Summary = {
  id: string;
  code: string;
  status: OrderStatus;
  storeId: string;
  storeName: string;
  storeSlug: string;
  storeImage: string | null;
  storeLat: number;
  storeLng: number;
  deliveryFee: number;
  minOrder: number;
  citySlug: string;
  total: number;
  itemCount: number;
  items: SummaryLine[];
  createdAt: string;
};

export function OrdersList() {
  const router = useRouter();
  const { addItem, clear } = useCart();
  const { t } = useI18n();
  const [tab, setTab] = useState<"orders" | "taxi">("orders");
  const [orders, setOrders] = useState<Summary[]>([]);
  const [rides, setRides] = useState<TaxiRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const ids = JSON.parse(window.localStorage.getItem("wassl_orders") || "[]") as string[];
        const byId = new Map<string, Summary>();

        if (ids.length) {
          const response = await fetch(
            `/api/orders?ids=${encodeURIComponent(ids.join(","))}`,
            { cache: "no-store" },
          );
          if (response.ok) {
            const data = (await response.json()) as { orders: Summary[] };
            for (const order of data.orders) byId.set(order.id, order);
          }
        }

        // Signed-in customers get their full account history on any device.
        const accountResponse = await fetch("/api/orders", { cache: "no-store" });
        if (accountResponse.ok) {
          const data = (await accountResponse.json()) as { orders: Summary[] };
          for (const order of data.orders) byId.set(order.id, order);
        }

        const ridesResponse = await fetch("/api/taxi/rides", { cache: "no-store" });
        if (ridesResponse.ok) {
          const data = (await ridesResponse.json()) as { rides?: TaxiRide[] };
          if (active) setRides(data.rides ?? []);
        }

        if (active) {
          setOrders(
            [...byId.values()].sort(
              (a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            ),
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  function openCode(event: React.FormEvent) {
    event.preventDefault();
    if (code.trim()) router.push(`/orders/${encodeURIComponent(code.trim())}`);
  }

  function reorder(order: Summary) {
    if (!order.items.length) return;
    clear();
    for (const line of order.items) {
      const modifierTotal = line.options.reduce((sum, option) => sum + option.priceDelta, 0);
      addItem(
        {
          productId: line.productId,
          storeId: order.storeId,
          storeSlug: order.storeSlug,
          storeName: order.storeName,
          citySlug: order.citySlug,
          storeLat: order.storeLat,
          storeLng: order.storeLng,
          deliveryFee: order.deliveryFee,
          minOrder: order.minOrder,
          name: line.name,
          emoji: line.emoji,
          image: line.image,
          basePrice: line.price - modifierTotal,
          price: line.price,
          options: line.options,
        },
        line.qty,
      );
    }
    router.push("/cart");
  }

  return (
    <div className="mt-6">
      <div className="flex gap-5 border-b border-line">
        {[
          { id: "orders" as const, label: t("Deliveries"), count: orders.length },
          { id: "taxi" as const, label: t("Taxi rides"), count: rides.length },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`relative inline-flex items-center gap-2 px-1 pb-3 pt-1 text-[13px] transition-colors ${
              tab === item.id
                ? "font-semibold text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-brand"
                : "text-muted hover:text-ink"
            }`}
          >
            {item.id === "taxi" ? <CarTaxiFront size={14} /> : <ReceiptText size={14} />}
            {item.label}
            <span
              className={`rounded-[2px] px-1.5 py-0.5 text-[10px] tnum ${
                tab === item.id
                  ? "bg-surface-2 font-semibold text-ink"
                  : "bg-transparent text-muted"
              }`}
            >
              {item.count}
            </span>
          </button>
        ))}
      </div>

      {tab === "orders" ? (
        <form onSubmit={openCode} className="mt-5 max-w-xl">
          <label htmlFor="order-code" className="label">
            {t("Order code")}
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search
                size={15}
                className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                id="order-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className="input h-11 ps-9 tnum"
                placeholder="WSL-84F2A1"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <button type="submit" className="btn btn-primary">
              {t("Track")} <ArrowRight size={13} className="rtl:-scale-x-100" />
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-muted">
            {t("e.g. {code}", { code: "WSL-84F2A1" })}
          </p>
        </form>
      ) : null}

      {tab === "orders" ? (
        <>
      {loading ? (
        <div className="mt-4 border-t border-line">
          <div className="h-24 animate-pulse rounded-[10px] bg-surface-2" />
          <div className="h-24 animate-pulse rounded-[10px] bg-surface-2" />
        </div>
      ) : orders.length ? (
        <div className="mt-4 border-t border-line">
          {orders.map((order) => {
            const meta = STATUS_META[order.status];
            return (
              <div
                key={order.id}
                className="flex flex-wrap items-center gap-4 border-b border-line py-4 transition-colors hover:bg-surface"
              >
                <Link
                  href={`/orders/${order.id}`}
                  className="group flex min-w-0 flex-1 flex-wrap items-center gap-4"
                >
                  <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[4px] bg-surface-2">
                    {order.storeImage ? (
                      <Image
                        src={order.storeImage}
                        alt=""
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-brand/50">
                        <ReceiptText size={18} />
                      </span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-semibold">{order.storeName}</span>
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
                        <span className="status-dot" /> {t(meta.label)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted tnum">
                      <span>{order.code}</span>
                      <span className="text-line-strong">/</span>
                      <span>
                        {t("{count} items", { count: order.itemCount })}
                      </span>
                      <span className="text-line-strong">/</span>
                      <span>{timeAgo(order.createdAt)}</span>
                    </div>
                  </div>
                  <div className="text-end">
                    <div className="text-[14px] font-semibold tnum">{money(order.total)}</div>
                    <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-brand">
                      Track{" "}
                      <ArrowRight
                        size={11}
                        className="transition group-hover:translate-x-0.5"
                      />
                    </div>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => reorder(order)}
                  className="btn btn-ghost btn-sm shrink-0"
                  aria-label={`${t("Reorder")} · ${order.storeName}`}
                >
                  <RotateCcw size={12} /> {t("Reorder")}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-6 aero-tile rounded-[10px] border px-6 py-16 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-[8px] bg-surface-2 text-brand">
            <PackageCheck size={20} strokeWidth={1.6} />
          </div>
          <h2 className="display-sm mt-4 text-[clamp(1.6rem,1.3rem+1vw,2.2rem)]">
            {t("No orders yet")}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-[13px] leading-6 text-muted">
            {t(
              "Your local orders will appear here. Try Dakhla Grill or Sahara Market to see the full flow.",
            )}
          </p>
          <Link href="/city/dakhla" className="btn btn-primary mt-5">
            {t("Browse Dakhla")} <ArrowRight size={14} className="rtl:-scale-x-100" />
          </Link>
        </div>
      )}
        </>
      ) : rides.length ? (
        <div className="mt-4 border-t border-line">
          {rides.map((ride) => {
            const active = !["completed", "cancelled"].includes(ride.status);
            return (
              <Link
                key={ride.id}
                href={`/taxi/${ride.id}`}
                className={`flex flex-wrap items-center gap-4 border-b border-line py-4 transition-colors hover:bg-surface ${
                  active ? "" : "opacity-80"
                }`}
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[4px] bg-surface-2 text-ink">
                  <CarTaxiFront size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[14px] font-semibold">
                      {ride.pickupLabel} → {ride.dropoffLabel}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
                      <span className="status-dot" /> {t(TAXI_STATUS_TEXT[ride.status])}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted tnum">
                    <span>{ride.distanceKm.toFixed(1)} km</span>
                    <span>·</span>
                    <span>{timeAgo(ride.createdAt)}</span>
                    {ride.driverName ? (
                      <>
                        <span>·</span>
                        <span>{ride.driverName}</span>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="text-end">
                  <div className="text-[14px] font-semibold tnum">{money(ride.fare)}</div>
                  <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-brand">
                    {t(active ? "Track" : "View")} <ArrowRight size={11} className="rtl:-scale-x-100" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="mt-6 aero-tile rounded-[10px] border px-6 py-16 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-[8px] bg-surface-2 text-brand">
            <CarTaxiFront size={20} strokeWidth={1.6} />
          </div>
          <h2 className="display-sm mt-4 text-[clamp(1.6rem,1.3rem+1vw,2.2rem)]">
            {t("No taxi rides yet")}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-[13px] leading-6 text-muted">
            {t("Your taxi trips will appear here once you request a ride.")}
          </p>
          <Link href="/taxi" className="btn btn-primary mt-5">
            {t("Request a taxi")} <ArrowRight size={14} className="rtl:-scale-x-100" />
          </Link>
        </div>
      )}

      <div className="mt-6 grid overflow-hidden aero-tile rounded-[10px] border sm:grid-cols-3">
        {(tab === "taxi"
          ? [
              {
                icon: CarTaxiFront,
                label: t("Live ride status"),
                text: t("Updates without refreshing."),
              },
              {
                icon: Bike,
                label: t("Driver details"),
                text: t("Call the driver after assignment."),
              },
              {
                icon: Banknote,
                label: t("Cash fare"),
                text: t("Pay the driver at the end of the trip."),
              },
            ]
          : [
              { icon: Clock3, label: t("Live status"), text: t("Updates without refreshing.") },
              {
                icon: Bike,
                label: t("Driver details"),
                text: t("Call or WhatsApp after assignment."),
              },
              {
                icon: ReceiptText,
                label: t("Cash receipt"),
                text: t("See the exact amount before arrival."),
              },
            ]
        ).map((item, index) => (
          <div
            key={item.label}
            className={`flex gap-2.5 p-3.5 ${
              index > 0 ? "border-t border-line sm:border-s sm:border-t-0" : ""
            }`}
          >
            <item.icon size={15} strokeWidth={1.7} className="mt-0.5 shrink-0 text-brand" />
            <div className="min-w-0">
              <div className="text-[12px] font-semibold">{item.label}</div>
              <div className="mt-0.5 text-[11px] leading-5 text-muted">{item.text}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
