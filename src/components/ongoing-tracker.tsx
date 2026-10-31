"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  Bike,
  CarTaxiFront,
  ChevronDown,
  ChevronUp,
  MapPin,
} from "lucide-react";
import { useLiveActivity } from "./live-activity-provider";
import { useI18n } from "./locale-provider";
import { STATUS_META, type OrderStatus } from "@/lib/types";
import { TAXI_STATUS_TEXT, TAXI_STATUS_ORDER } from "@/lib/taxi-status";
import { money, timeAgo } from "@/lib/utils";

type OngoingItem =
  | {
      kind: "order";
      id: string;
      status: OrderStatus;
      title: string;
      subtitle: string;
      href: string;
      createdAt: string;
      amount: number;
      step: number;
      total: number;
    }
  | {
      kind: "taxi";
      id: string;
      status: keyof typeof TAXI_STATUS_TEXT;
      title: string;
      subtitle: string;
      href: string;
      createdAt: string;
      amount: number;
      step: number;
      total: number;
    };

const ORDER_STEPS: OrderStatus[] = [
  "placed",
  "accepted",
  "preparing",
  "ready",
  "assigned",
  "picked_up",
  "en_route",
  "delivered",
];

export function OngoingTracker() {
  const { activeOrders, activeRides } = useLiveActivity();
  const { t } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const items: OngoingItem[] = [
    ...activeOrders.map((order) => {
      const index = ORDER_STEPS.indexOf(order.status);
      return {
        kind: "order" as const,
        id: order.id,
        status: order.status,
        title: order.storeName,
        subtitle: `${order.code} · ${order.itemCount} ${order.itemCount === 1 ? t("item") : t("items")}`,
        href: `/orders/${order.id}`,
        createdAt: order.createdAt,
        amount: order.total,
        step: index < 0 ? 0 : index,
        total: ORDER_STEPS.length - 1,
      };
    }),
    ...activeRides.map((ride) => {
      const index = TAXI_STATUS_ORDER.indexOf(ride.status);
      return {
        kind: "taxi" as const,
        id: ride.id,
        status: ride.status,
        title: t("Wassl Taxi"),
        subtitle: `${ride.pickupLabel} → ${ride.dropoffLabel}`,
        href: `/taxi/${ride.id}`,
        createdAt: ride.createdAt,
        amount: ride.fare,
        step: index < 0 ? 0 : index,
        total: TAXI_STATUS_ORDER.length - 1,
      };
    }),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const current = items.find((item) => !pathname.startsWith(item.href));
  if (!current) return null;

  const progress = Math.max(8, Math.min(100, (current.step / current.total) * 100));
  const label =
    current.kind === "order"
      ? t(STATUS_META[current.status].label)
      : t(TAXI_STATUS_TEXT[current.status]);
  const Icon = current.kind === "taxi" ? CarTaxiFront : Bike;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="fixed bottom-[calc(82px+env(safe-area-inset-bottom))] end-3 z-40 flex items-center gap-2 rounded-full border border-teal/25 bg-ink px-3.5 py-2.5 text-xs font-extrabold text-on-dark shadow-2xl transition hover:-translate-y-0.5 md:bottom-6 md:end-6"
        aria-label={t("Show live progress")}
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-saffron opacity-70" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-saffron" />
        </span>
        {label}
        <ChevronUp size={14} />
      </button>
    );
  }

  return (
    <div className="fixed inset-x-3 bottom-[calc(82px+env(safe-area-inset-bottom))] z-40 md:inset-x-auto md:bottom-6 md:end-6 md:w-[370px]">
      <div className="overflow-hidden rounded-2xl border border-teal/20 bg-paper/95 shadow-[0_24px_60px_-24px_rgba(15,60,58,.55)] backdrop-blur-xl">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center gap-3 px-3.5 py-3 text-start"
        >
          <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal text-on-dark">
            <Icon size={18} />
            <span className="absolute -end-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-paper bg-saffron" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.14em] text-teal">
              <span className="status-dot live-dot" />
              {current.kind === "taxi" ? t("Taxi in progress") : t("Order in progress")}
            </span>
            <span className="mt-0.5 block truncate text-[13px] font-extrabold">
              {current.title}
            </span>
            <span className="block truncate text-[10px] font-bold text-ink/45">
              {label} · {money(current.amount)}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <span className="text-[9px] font-bold text-ink/30">{timeAgo(current.createdAt)}</span>
            {open ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
          </span>
        </button>

        <div className="px-3.5 pb-2">
          <div className="relative h-1.5 overflow-hidden rounded-full bg-ink/10">
            <div
              className="absolute inset-y-0 start-0 rounded-full bg-gradient-to-r from-teal to-saffron transition-[width] duration-700"
              style={{ width: `${progress}%` }}
            />
            <div className="absolute inset-0 animate-shimmer bg-[linear-gradient(110deg,transparent_20%,rgba(255,255,255,.55)_45%,transparent_70%)]" />
          </div>
        </div>

        {open ? (
          <div className="border-t border-ink/8 px-3.5 py-3">
            {items.length > 1 ? (
              items
                .filter((item) => item.id !== current.id)
                .map((item) => (
                  <Link
                    key={`${item.kind}-${item.id}`}
                    href={item.href}
                    className="flex items-center gap-2 rounded-xl px-1 py-2 text-xs transition hover:bg-cream/60"
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-teal/10 text-teal">
                      {item.kind === "taxi" ? <CarTaxiFront size={14} /> : <Bike size={14} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-extrabold">{item.title}</span>
                      <span className="block truncate text-[10px] text-ink/40">{item.subtitle}</span>
                    </span>
                    <ArrowRight size={13} className="shrink-0 text-ink/30 rtl:-scale-x-100" />
                  </Link>
                ))
            ) : (
              <div className="flex items-center gap-2 rounded-xl bg-cream/60 px-2 py-2 text-[11px] font-bold text-ink/55">
                <MapPin size={13} className="shrink-0 text-teal" />
                <span className="truncate">{current.subtitle}</span>
              </div>
            )}

            <div className="mt-2 flex items-center gap-2">
              <Link href={current.href} className="btn btn-primary btn-sm flex-1">
                {t("Track live")}
                <ArrowRight size={13} className="rtl:-scale-x-100" />
              </Link>
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                className="btn btn-ghost btn-sm"
                title={t("Minimize")}
              >
                <ChevronDown size={13} />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
