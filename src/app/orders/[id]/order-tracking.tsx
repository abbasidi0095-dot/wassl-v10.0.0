"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Banknote,
  Bike,
  Check,
  CheckCircle2,
  Clock3,
  MapPin,
  MessageCircle,
  Phone,
  ReceiptText,
  ShieldCheck,
  Star,
} from "lucide-react";
import type { OrderView } from "@/lib/db";
import { ProductTile } from "@/components/product-icon";
import { STATUS_META } from "@/lib/types";
import { clock, money, timeAgo } from "@/lib/utils";
import { MapView } from "@/components/map-view";
import { OrderRefundPanel } from "./order-refund-panel";
import { useLiveEvents } from "@/lib/use-live-events";

const STEPS: { status: string; label: string; caption: string }[] = [
  { status: "placed", label: "Order placed", caption: "Sent to the store" },
  { status: "accepted", label: "Accepted", caption: "The store is on it" },
  { status: "preparing", label: "Preparing", caption: "Your food is being made" },
  { status: "ready", label: "Ready", caption: "Waiting for a driver" },
  { status: "assigned", label: "Driver assigned", caption: "A local driver is coming" },
  { status: "picked_up", label: "Picked up", caption: "Leaving the store" },
  { status: "en_route", label: "On the way", caption: "Follow the live map" },
  { status: "delivered", label: "Delivered", caption: "Enjoy your order" },
];

export function OrderTracking({ initial }: { initial: OrderView }) {
  const [order, setOrder] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    try {
      const existing = JSON.parse(window.localStorage.getItem("wassl_orders") || "[]") as string[];
      window.localStorage.setItem(
        "wassl_orders",
        JSON.stringify([order.id, ...existing.filter((id) => id !== order.id)].slice(0, 40)),
      );
    } catch {
      // history is optional
    }
  }, [order.id]);

  async function refresh(silent = false) {
    if (!silent) setRefreshing(true);
    try {
      const response = await fetch(`/api/orders/${order.id}`, { cache: "no-store" });
      if (response.ok) {
        const data = (await response.json()) as { order: OrderView };
        setOrder(data.order);
      }
    } finally {
      if (!silent) setRefreshing(false);
    }
  }

  useLiveEvents({ orderId: order.id }, () => {
    void refresh(true);
  });

  useEffect(() => {
    const timer = window.setInterval(() => refresh(true), 10000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  const currentIndex = STEPS.findIndex((step) => step.status === order.status);
  const cancelled = order.status === "cancelled";
  const delivered = order.status === "delivered";
  const etaMinutes =
    order.status === "placed" || order.status === "accepted"
      ? (order.store?.prepTime || 25) + 18
      : order.status === "preparing"
        ? 28
        : order.status === "ready"
          ? 20
          : 16;

  const points = useMemo(
    () => [
      ...(order.store
        ? [
            {
              id: "store",
              lat: order.store.lat,
              lng: order.store.lng,
              kind: "store" as const,
              label: order.store.name,
            },
          ]
        : []),
      ...(order.driver
        ? [
            {
              id: "driver",
              lat: order.driver.lat,
              lng: order.driver.lng,
              kind: "driver" as const,
              label: `${order.driver.name} · driver`,
            },
          ]
        : []),
      {
        id: "customer",
        lat: order.lat,
        lng: order.lng,
        kind: "customer" as const,
        label: "Your delivery address",
      },
    ],
    [order],
  );

  const route = order.store
    ? ([
        [order.store.lat, order.store.lng],
        [order.lat, order.lng],
      ] as [number, number][])
    : undefined;

  const whatsappPhone = order.driver?.phone.replace(/[^0-9]/g, "");
  const meta = STATUS_META[order.status];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/orders"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-muted hover:text-brand"
          >
            <ArrowLeft size={13} /> All orders
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-[clamp(1.9rem,1.5rem+1.4vw,2.6rem)] font-semibold tracking-[-0.035em]">
              {delivered ? "Delivered. Enjoy!" : cancelled ? "Order cancelled" : "Your order is moving."}
            </h1>
            <span className="pill">{order.code}</span>
          </div>
          <p className="mt-2 text-sm text-muted">
            {order.store?.name} · {timeAgo(order.createdAt)}
            {refreshing ? <span className="ms-2 text-brand">updating…</span> : null}
          </p>
        </div>
        <div className="flex gap-2">
          {!delivered && !cancelled ? (
            <div className="rounded-[10px] border border-teal/15 bg-brand-soft px-4 py-2.5 text-end">
              <div className="text-[11px] font-medium text-brand">
                Estimated arrival
              </div>
              <div className="text-lg font-semibold">{etaMinutes} min</div>
            </div>
          ) : null}
          <button type="button" onClick={() => void refresh()} className="btn btn-ghost btn-sm self-center">
            Refresh
          </button>
        </div>
      </div>

      {order.deliveryPin && !delivered && !cancelled ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-line bg-surface px-4 py-3">
          <div>
            <div className="text-[11px] text-muted">
              {order.fulfillment === "pickup" ? "Pickup code" : "Delivery PIN"}
            </div>
            <div className="mt-1 font-display text-[22px] font-semibold tracking-[0.14em] tnum">
              {order.fulfillment === "pickup" ? order.pickupCode : order.deliveryPin}
            </div>
            <div className="text-[11px] text-muted">
              {order.fulfillment === "pickup"
                ? "Show this code to the store when you collect."
                : "Share this PIN with the driver at handover."}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
            {order.fulfillment === "pickup" ? <span className="pill">Pickup</span> : null}
            {order.express ? <span className="pill pill-warm">Express</span> : null}
            {order.deliveryWindow ? <span className="pill">{order.deliveryWindow}</span> : null}
            {order.substitutionPreference ? (
              <span className="pill">Substitution: {order.substitutionPreference}</span>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <div className="space-y-4">
          <div className="card overflow-hidden">
            <MapView
              points={points}
              center={{ lat: order.lat, lng: order.lng }}
              zoom={14}
              height={365}
              route={route}
              followDriverId={order.driver ? "driver" : undefined}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-paper px-4 py-3">
              <div className="flex items-center gap-2">
                <span
                  className={`status-dot ${delivered ? "" : "live-dot"} ${
                    cancelled ? "text-danger" : "text-brand"
                  }`}
                />
                <div>
                  <div className="text-[11px] font-semibold">{meta.label}</div>
                  <div className="text-[11px] font-bold text-muted">
                    {delivered
                      ? `Delivered at ${order.deliveredAt ? clock(order.deliveredAt) : "—"}`
                      : cancelled
                        ? "This order was cancelled"
                        : "Live updates are on"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-bold text-muted">
                <MapPin size={12} className="text-brand" />
                {order.address} · {order.landmark}
              </div>
            </div>
          </div>

          {order.driver ? (
            <div className="card flex flex-wrap items-center gap-3 p-4">
              <span className="grid h-11 w-11 place-items-center rounded-[6px] bg-surface-2 text-ink">
                <Bike size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{order.driver.name}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] font-bold text-muted">
                  <span>{order.driver.vehicle}</span>
                  <span>·</span>
                  <span>{order.driver.plate}</span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Star size={10} className="fill-saffron text-saffron" />
                    {order.driver.rating}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <a href={`tel:${order.driver.phone.replace(/\s/g, "")}`} className="btn btn-ghost btn-sm">
                  <Phone size={13} /> Call
                </a>
                {whatsappPhone ? (
                  <a
                    href={`https://wa.me/${whatsappPhone}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-primary btn-sm"
                  >
                    <MessageCircle size={13} /> WhatsApp
                  </a>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="card flex items-center gap-3 p-4">
              <span className="grid h-11 w-11 place-items-center rounded-[6px] bg-surface-2 text-muted"><Bike size={20} /></span>
              <div>
                <div className="text-sm font-semibold">Finding your driver</div>
                <div className="mt-0.5 text-[11px] font-bold text-muted">
                  A local driver will be assigned as soon as the store marks the order ready.
                </div>
              </div>
            </div>
          )}

          <div className="card p-5">
            <h2 className="font-display text-[20px] font-semibold tracking-[-0.02em]">Order timeline</h2>
            <div className="mt-4">
              {cancelled ? (
                <div className="rounded-[6px] bg-danger-soft p-3 text-xs font-bold text-danger">
                  This order was cancelled. If you were charged, contact support.
                </div>
              ) : (
                <div className="space-y-0">
                  {STEPS.map((step, index) => {
                    const event = order.events.find((item) => item.type === step.status);
                    const done = Boolean(event) || index <= currentIndex;
                    const active = index === currentIndex;
                    return (
                      <div key={step.status} className="relative flex gap-3 pb-4 last:pb-0">
                        {index < STEPS.length - 1 ? (
                          <span
                            className={`absolute start-[9px] top-5 h-full w-px ${
                              done ? "timeline-line" : "bg-ink/10"
                            }`}
                          />
                        ) : null}
                        <span
                          className={`relative z-10 mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2 ${
                            done
                              ? "border-brand bg-brand text-paper"
                              : "border-line-strong bg-paper text-transparent"
                          }`}
                        >
                          <Check size={10} strokeWidth={3} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-[13px] ${active ? "font-semibold text-ink" : done ? "font-medium text-ink" : "text-muted/60"}`}>
                              {step.label}
                            </span>
                            <span className="text-[11px] font-bold text-muted">
                              {event ? clock(event.at) : ""}
                            </span>
                          </div>
                          <div className="text-[11px] text-muted">{step.caption}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[20px] font-semibold tracking-[-0.02em]">Receipt</h2>
              <ReceiptText size={16} className="text-muted" />
            </div>
            <div className="mt-1 text-[11px] text-muted">
              {order.store?.name}
            </div>
            <div className="mt-3 space-y-2">
              {order.items.map((item, index) => (
                <div key={`${item.productId}-${index}`} className="flex items-center gap-2 text-[11px]">
                  <ProductTile name={item.name} className="h-7 w-7 rounded-[6px]" iconSize={14} />
                  <span className="min-w-0 flex-1 font-medium">
                    <span className="block truncate">{item.qty}× {item.name}</span>
                    {item.options?.length ? (
                      <span className="block truncate text-[11px] text-muted">
                        {item.options.map((option) => option.optionName).join(" · ")}
                      </span>
                    ) : null}
                  </span>
                  <span className="font-semibold tnum">{money(item.price * item.qty)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-1.5 border-t border-line pt-3 text-[13px]">
              <div className="flex justify-between text-muted">
                <span>Subtotal</span>
                <span className="font-medium text-ink tnum">{money(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>Delivery</span>
                <span className="font-medium text-ink tnum">{money(order.deliveryFee)}</span>
              </div>
              <div className="flex justify-between border-t border-line pt-2 text-[15px] font-semibold">
                <span>Total</span>
                <span className="tnum">{money(order.total)}</span>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 border-s-2 border-signal ps-3">
              <Banknote size={16} className="text-signal" />
              <div>
                <div className="text-[13px] font-medium">
                  Cash on delivery
                </div>
                <div className="text-[11px] text-muted">
                  {order.cashCollected ? "Cash collected" : `Pay ${money(order.total)} on arrival`}
                </div>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="text-[13px] font-semibold">Delivery address</h2>
            <div className="mt-3 flex items-start gap-2 text-[13px] leading-5 text-muted">
              <MapPin size={14} className="mt-0.5 shrink-0 text-brand" />
              <div>
                <div className="font-medium text-ink">{order.address}</div>
                <div>{order.landmark}</div>
                {order.notes ? <div className="mt-1 italic text-muted">“{order.notes}”</div> : null}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-muted">
              <Phone size={13} className="text-brand" /> {order.customerPhone}
            </div>
            {order.scheduledFor ? (
              <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
                <Clock3 size={13} className="text-brand" /> Scheduled for{" "}
                {new Date(order.scheduledFor).toLocaleString("en-GB", {
                  weekday: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            ) : null}
          </div>

          <div className="rounded-[10px] bg-ink p-5 text-on-dark">
            <div className="flex items-center gap-2 text-[11px] font-medium text-on-dark/40">
              <ShieldCheck size={13} className="text-saffron" /> Wassl support
            </div>
            <p className="mt-2 text-sm font-semibold">Something wrong with your order?</p>
            <p className="mt-1 text-[11px] leading-5 text-on-dark/50">
              Call us and we will contact the store and driver directly.
            </p>
            <a href="tel:+212660000000" className="btn btn-saffron mt-4 w-full">
              <Phone size={14} /> Call support
            </a>
          </div>

          {delivered ? (
            <>
              {order.store?.category === "grocery" ? (
                <OrderRefundPanel orderId={order.id} />
              ) : null}
              <Link href={`/store/${order.store?.slug}`} className="btn btn-ghost w-full">
                <CheckCircle2 size={15} className="text-brand" /> Order again
              </Link>
            </>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
