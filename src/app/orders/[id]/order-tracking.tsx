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
            className="inline-flex items-center gap-1 text-[11px] font-bold text-ink/35 hover:text-teal"
          >
            <ArrowLeft size={13} /> All orders
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-extrabold tracking-[-0.055em] sm:text-4xl">
              {delivered ? "Delivered. Enjoy!" : cancelled ? "Order cancelled" : "Your order is moving."}
            </h1>
            <span className="pill">{order.code}</span>
          </div>
          <p className="mt-2 text-sm text-ink/45">
            {order.store?.name} · {timeAgo(order.createdAt)}
            {refreshing ? <span className="ms-2 text-teal">updating…</span> : null}
          </p>
        </div>
        <div className="flex gap-2">
          {!delivered && !cancelled ? (
            <div className="rounded-2xl border border-teal/15 bg-teal/8 px-4 py-2.5 text-end">
              <div className="text-[9px] font-extrabold uppercase tracking-wider text-teal">
                Estimated arrival
              </div>
              <div className="text-lg font-extrabold">{etaMinutes} min</div>
            </div>
          ) : null}
          <button type="button" onClick={() => void refresh()} className="btn btn-ghost btn-sm self-center">
            Refresh
          </button>
        </div>
      </div>

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
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/8 bg-paper px-4 py-3">
              <div className="flex items-center gap-2">
                <span
                  className={`status-dot ${delivered ? "" : "live-dot"} ${
                    cancelled ? "text-red-500" : "text-teal"
                  }`}
                />
                <div>
                  <div className="text-[11px] font-extrabold">{meta.label}</div>
                  <div className="text-[9px] font-bold text-ink/35">
                    {delivered
                      ? `Delivered at ${order.deliveredAt ? clock(order.deliveredAt) : "—"}`
                      : cancelled
                        ? "This order was cancelled"
                        : "Live updates are on"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-bold text-ink/35">
                <MapPin size={12} className="text-teal" />
                {order.address} · {order.landmark}
              </div>
            </div>
          </div>

          {order.driver ? (
            <div className="card flex flex-wrap items-center gap-3 p-4">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-teal text-on-dark">
                <Bike size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-extrabold">{order.driver.name}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] font-bold text-ink/40">
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
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-saffron/20 text-saffron-deep"><Bike size={20} /></span>
              <div>
                <div className="text-sm font-extrabold">Finding your driver</div>
                <div className="mt-0.5 text-[10px] font-bold text-ink/40">
                  A local driver will be assigned as soon as the store marks the order ready.
                </div>
              </div>
            </div>
          )}

          <div className="card p-5">
            <h2 className="text-lg font-extrabold tracking-tight">Order timeline</h2>
            <div className="mt-4">
              {cancelled ? (
                <div className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">
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
                          className={`relative z-10 mt-0.5 grid h-[19px] w-[19px] shrink-0 place-items-center rounded-full border-2 ${
                            done
                              ? "border-teal bg-teal text-on-dark"
                              : "border-ink/15 bg-paper text-transparent"
                          }`}
                        >
                          <Check size={10} strokeWidth={3} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-[12px] font-extrabold ${active ? "text-teal" : done ? "text-ink" : "text-ink/35"}`}>
                              {step.label}
                            </span>
                            <span className="text-[9px] font-bold text-ink/30">
                              {event ? clock(event.at) : ""}
                            </span>
                          </div>
                          <div className="text-[10px] text-ink/35">{step.caption}</div>
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
              <h2 className="text-lg font-extrabold tracking-tight">Receipt</h2>
              <ReceiptText size={17} className="text-teal" />
            </div>
            <div className="mt-3 text-[10px] font-extrabold uppercase tracking-wider text-ink/35">
              {order.store?.name}
            </div>
            <div className="mt-3 space-y-2">
              {order.items.map((item, index) => (
                <div key={`${item.productId}-${index}`} className="flex items-center gap-2 text-[11px]">
                  <ProductTile name={item.name} className="h-7 w-7 rounded-lg" iconSize={14} />
                  <span className="min-w-0 flex-1 font-bold text-ink/60">
                    <span className="block truncate">{item.qty}× {item.name}</span>
                    {item.options?.length ? (
                      <span className="block truncate text-[9px] text-ink/35">
                        {item.options.map((option) => option.optionName).join(" · ")}
                      </span>
                    ) : null}
                  </span>
                  <span className="font-extrabold">{money(item.price * item.qty)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-1.5 border-t border-ink/8 pt-3 text-[11px]">
              <div className="flex justify-between text-ink/45">
                <span>Subtotal</span>
                <span className="font-bold text-ink">{money(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-ink/45">
                <span>Delivery</span>
                <span className="font-bold text-ink">{money(order.deliveryFee)}</span>
              </div>
              <div className="flex justify-between pt-1 text-base font-extrabold">
                <span>Total</span>
                <span>{money(order.total)}</span>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-saffron/15 p-3">
              <Banknote size={17} className="text-ink/60" />
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-ink/55">
                  Cash on delivery
                </div>
                <div className="text-[10px] font-bold text-ink/40">
                  {order.cashCollected ? "Cash collected" : `Pay ${money(order.total)} on arrival`}
                </div>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-extrabold">Delivery address</h2>
            <div className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-ink/55">
              <MapPin size={14} className="mt-0.5 shrink-0 text-teal" />
              <div>
                <div className="font-bold text-ink">{order.address}</div>
                <div className="text-ink/40">{order.landmark}</div>
                {order.notes ? <div className="mt-1 italic text-ink/35">“{order.notes}”</div> : null}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-ink/50">
              <Phone size={13} className="text-teal" /> {order.customerPhone}
            </div>
            {order.scheduledFor ? (
              <div className="mt-2 flex items-center gap-2 text-[11px] text-ink/50">
                <Clock3 size={13} className="text-teal" /> Scheduled for{" "}
                {new Date(order.scheduledFor).toLocaleString("en-GB", {
                  weekday: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl bg-ink p-5 text-on-dark">
            <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider text-on-dark/40">
              <ShieldCheck size={13} className="text-saffron" /> Wassl support
            </div>
            <p className="mt-2 text-sm font-extrabold">Something wrong with your order?</p>
            <p className="mt-1 text-[11px] leading-5 text-on-dark/50">
              Call us and we will contact the store and driver directly.
            </p>
            <a href="tel:+212660000000" className="btn btn-saffron mt-4 w-full">
              <Phone size={14} /> Call support
            </a>
          </div>

          {delivered ? (
            <Link href={`/store/${order.store?.slug}`} className="btn btn-ghost w-full">
              <CheckCircle2 size={15} className="text-teal" /> Order again
            </Link>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
