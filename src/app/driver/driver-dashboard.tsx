"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  Bike,
  CheckCircle2,
  ChevronRight,
  Gauge,
  LocateFixed,
  MapPin,
  Navigation,
  PackageCheck,
  Phone,
  PlayCircle,
  Power,
  RefreshCw,
  Route,
  Star,
  Store,
  Wallet,
} from "lucide-react";
import type { OrderView } from "@/lib/db";
import type { Driver } from "@/lib/types";
import { STATUS_META } from "@/lib/types";
import { clock, distanceKm, money, timeAgo } from "@/lib/utils";
import { MapView, type MapPoint } from "@/components/map-view";
import { HandoverPrompt } from "@/components/handover-code";
import { useLiveEvents } from "@/lib/use-live-events";

type Action = { label: string; status: string; icon: typeof Bike };

const NEXT_ACTION: Record<string, Action> = {
  assigned: { label: "Picked up from store", status: "picked_up", icon: PackageCheck },
  picked_up: { label: "Start delivery", status: "en_route", icon: Navigation },
  en_route: { label: "Delivered — collect cash", status: "delivered", icon: CheckCircle2 },
};

export function DriverDashboard({
  driver: initialDriver,
  initialOrders,
  initialCityOrders,
}: {
  driver: Driver;
  initialOrders: OrderView[];
  initialCityOrders: OrderView[];
}) {
  const [driver, setDriver] = useState(initialDriver);
  const [orders, setOrders] = useState(initialOrders);
  const [cityOrders, setCityOrders] = useState(initialCityOrders);
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");
  const [codeFor, setCodeFor] = useState<OrderView | null>(null);
  const [codeError, setCodeError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const watchRef = useRef<number | null>(null);
  const simRef = useRef<number | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: initialDriver.lat,
    lng: initialDriver.lng,
  });

  const active = useMemo(
    () => orders.filter((order) => ["assigned", "picked_up", "en_route"].includes(order.status)),
    [orders],
  );
  const history = useMemo(
    () => orders.filter((order) => order.status === "delivered").slice(0, 8),
    [orders],
  );
  const current = active[0];
  const online = driver.status !== "offline";
  const canClaim = driver.status === "available";
  const cashLeft = Math.max(0, driver.cashLimit - driver.cashOnHand);
  const earnings = history.reduce((sum, order) => sum + Math.round(order.deliveryFee * 0.8), 0);

  const postLocation = useCallback(async (lat: number, lng: number) => {
    setCoords({ lat, lng });
    await fetch("/api/driver/location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lng }),
    }).catch(() => null);
  }, []);

  const refresh = useCallback(
    async (silent = false) => {
      if (!silent) setRefreshing(true);
      try {
        const response = await fetch("/api/driver/queue", { cache: "no-store" });
        if (response.ok) {
          const data = (await response.json()) as {
            driver: Driver;
            orders: OrderView[];
            cityOrders: OrderView[];
          };
          setDriver(data.driver);
          setOrders(data.orders);
          setCityOrders(data.cityOrders);
        }
      } finally {
        if (!silent) setRefreshing(false);
      }
    },
    [],
  );

  useLiveEvents({ citySlug: driver.citySlug }, () => {
    void refresh(true);
  });

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const timer = window.setInterval(() => refresh(true), 10000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(
    () => () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      if (simRef.current !== null) window.clearInterval(simRef.current);
    },
    [],
  );

  async function toggleStatus() {
    setBusy("status");
    try {
      const next = online ? "offline" : "available";
      const response = await fetch("/api/driver/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = (await response.json()) as {
        driver?: Driver;
        error?: string;
      };
      if (!response.ok || !data.driver) {
        setToast(data.error || "Could not change your status");
        return;
      }
      setDriver(data.driver);
      setToast(next === "available" ? "You are online" : "You are offline");
      if (next === "available" && !sharing) {
        toggleShare();
      }
      if (next === "offline" && watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
        setSharing(false);
      }
    } finally {
      setBusy("");
    }
  }

  function toggleShare() {
    if (sharing) {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
      setSharing(false);
      setToast("Live GPS paused");
      return;
    }
    if (!navigator.geolocation) {
      setToast("This browser does not support GPS");
      return;
    }
    watchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        void postLocation(position.coords.latitude, position.coords.longitude);
      },
      () => {
        setToast("GPS permission denied. Use the route simulator.");
        setSharing(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 },
    );
    setSharing(true);
    setToast("Sharing live location");
  }

  function stopSimulation() {
    if (simRef.current !== null) window.clearInterval(simRef.current);
    simRef.current = null;
    setSimulating(false);
  }

  function simulate() {
    if (simulating) {
      stopSimulation();
      return;
    }
    const target = current
      ? current.status === "assigned"
        ? { lat: current.store?.lat ?? coords.lat, lng: current.store?.lng ?? coords.lng }
        : { lat: current.lat, lng: current.lng }
      : null;
    if (!target) {
      setToast("No active order to navigate");
      return;
    }
    setSimulating(true);
    setToast("Simulating the route");
    let step = 0;
    simRef.current = window.setInterval(() => {
      step += 1;
      const lat = driver.lat + (target.lat - driver.lat) * (step / 24);
      const lng = driver.lng + (target.lng - driver.lng) * (step / 24);
      void postLocation(lat, lng);
      if (step >= 24) {
        stopSimulation();
        setToast("Arrived at the next stop");
      }
    }, 1200);
  }

  async function advance(order: OrderView, proofPin?: string) {
    const action = NEXT_ACTION[order.status];
    if (!action) return;
    if (action.status === "delivered" && order.handoverRequired && !proofPin) {
      setCodeError("");
      setCodeFor(order);
      return;
    }
    setBusy(order.id);
    try {
      const response = await fetch(`/api/orders/${order.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action.status, proofPin }),
      });
      const data = (await response.json()) as { error?: string; order?: OrderView };
      if (!response.ok) {
        setCodeError(data.error || "Could not update the order");
        setToast(data.error || "Could not update the order");
        return;
      }
      setCodeFor(null);
      await refresh(true);
      if (action.status === "delivered") {
        setToast(`Delivered · ${money(order.total)} cash collected`);
        setDriver((value) => ({
          ...value,
          cashOnHand: value.cashOnHand + order.total,
          deliveries: value.deliveries + 1,
          status: "available",
        }));
      } else {
        setToast(action.label);
      }
    } finally {
      setBusy("");
    }
  }

  async function claim(order: OrderView) {
    setBusy(order.id);
    try {
      const response = await fetch(`/api/orders/${order.id}/claim`, {
        method: "POST",
      });
      const data = (await response.json()) as {
        error?: string;
        order?: OrderView;
        driver?: Driver;
      };
      if (!response.ok) {
        setToast(data.error || "Could not accept this delivery");
        await refresh(true);
        return;
      }
      if (data.driver) setDriver(data.driver);
      await refresh(true);
      setToast("Delivery accepted — your route is active");
    } finally {
      setBusy("");
    }
  }

  const points = useMemo(() => {
    const list: MapPoint[] = [
      {
        id: "me",
        lat: coords.lat,
        lng: coords.lng,
        kind: "driver" as const,
        label: `${driver.name} · ${driver.status}`,
      },
    ];
    for (const order of active) {
      if (order.store) {
        list.push({
          id: `store-${order.id}`,
          lat: order.store.lat,
          lng: order.store.lng,
          kind: "store",
          label: order.store.name,
        });
      }
      list.push({
        id: `customer-${order.id}`,
        lat: order.lat,
        lng: order.lng,
        kind: "customer",
        label: order.address,
      });
    }
    return list;
  }, [active, coords, driver.name, driver.status]);

  const route = useMemo<[number, number][] | undefined>(() => {
    if (!current) return undefined;
    const store = current.store;
    if (!store) return undefined;
    if (current.status === "assigned") {
      return [
        [coords.lat, coords.lng],
        [store.lat, store.lng],
      ];
    }
    return [
      [store.lat, store.lng],
      [current.lat, current.lng],
    ];
  }, [current, coords]);

  const distance = current?.store
    ? distanceKm(
        { lat: coords.lat, lng: coords.lng },
        current.status === "assigned"
          ? { lat: current.store.lat, lng: current.store.lng }
          : { lat: current.lat, lng: current.lng },
      )
    : 0;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="eyebrow">{driver.citySlug} · shift</div>
          <h1 className="display mt-2 text-[clamp(1.9rem,1.5rem+1.4vw,2.7rem)]">
            {online ? "You are on the road." : "You are offline."}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] font-bold text-muted">
            <span className="inline-flex items-center gap-1">
              <Star size={12} className="fill-saffron text-saffron" />
              {driver.rating} rating
            </span>
            <span className="inline-flex items-center gap-1">
              <Bike size={12} className="text-brand" />
              {driver.vehicle} · {driver.plate}
            </span>
            <span className="inline-flex items-center gap-1">
              <Phone size={12} className="text-brand" />
              {driver.phone}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleStatus}
            disabled={busy === "status" || Boolean(current)}
            className={`btn ${online ? "btn-ghost" : "btn-primary"}`}
            title={current ? "Finish the active delivery first" : undefined}
          >
            <Power size={15} />
            {online ? "Go offline" : "Go online"}
          </button>
          <button type="button" onClick={() => refresh()} className="btn btn-ghost">
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: "Deliveries",
            value: `${driver.deliveries}`,
            icon: PackageCheck,
            tone: "bg-brand-soft text-brand",
          },
          {
            label: "Cash on hand",
            value: money(driver.cashOnHand),
            icon: Wallet,
            tone: "bg-saffron/20 text-ink",
          },
          {
            label: "Cash limit left",
            value: money(cashLeft),
            icon: Gauge,
            tone: cashLeft < 100 ? "bg-danger-soft text-danger" : "bg-surface-2 text-ink",
          },
          {
            label: "Active orders",
            value: `${active.length}`,
            icon: Route,
            tone: "bg-blue-50 text-blue-600",
          },
        ].map((item) => (
          <div key={item.label}>
            <div className="text-[11px] text-muted">{item.label}</div>
            <div className="mt-1.5 font-display text-[24px] font-semibold leading-none tracking-[-0.03em] tnum">
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {driver.cashOnHand >= driver.cashLimit ? (
        <div className="mt-3 border-s-2 border-danger ps-3 text-[13px] text-danger">
          You reached your cash limit. Hand over {money(driver.cashOnHand)} to dispatch before
          taking new COD orders.
        </div>
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <div className="space-y-4">
          <div className="card overflow-hidden">
            <MapView
              points={points}
              center={{ lat: coords.lat, lng: coords.lng }}
              zoom={14}
              height={340}
              route={route}
              followDriverId="me"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-paper px-4 py-3">
              <div className="flex items-center gap-2">
                <span className={`status-dot ${online ? "live-dot text-brand" : "text-muted"}`} />
                <div>
                  <div className="text-[11px] font-semibold">
                    {sharing ? "Live GPS sharing" : simulating ? "Simulating route" : "GPS idle"}
                  </div>
                  <div className="text-[11px] font-bold text-muted">
                    {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                    {current ? ` · ${distance.toFixed(1)} km to next stop` : ""}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={toggleShare} className="btn btn-ghost btn-sm">
                  <LocateFixed size={13} />
                  {sharing ? "Stop GPS" : "Share GPS"}
                </button>
                <button type="button" onClick={simulate} className="btn btn-primary btn-sm">
                  <PlayCircle size={13} />
                  {simulating ? "Stop demo" : "Simulate route"}
                </button>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-[-0.04em]">Assigned orders</h2>
              <span className="pill">{active.length} active</span>
            </div>
            {orders.length ? (
              <div className="mt-4 space-y-3">
                {active.map((order) => {
                  const meta = STATUS_META[order.status];
                  const action = NEXT_ACTION[order.status];
                  return (
                    <article
                      key={order.id}
                      data-order-id={order.id}
                      className="card-flat p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[13px] font-semibold">{order.code}</span>
                            <span className="pill">{meta.label}</span>
                          </div>
                          <div className="mt-1 text-[11px] font-bold text-muted">
                            {timeAgo(order.createdAt)} · {order.customerName}
                          </div>
                        </div>
                        <div className="text-end">
                          <div className="text-base font-semibold">{money(order.total)}</div>
                          <div className="text-[11px] font-medium text-brand">
                            collect cash
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 space-y-2 text-[11px]">
                        <div className="flex items-start gap-2">
                          <Store size={13} className="mt-0.5 shrink-0 text-brand" />
                          <div>
                            <div className="font-semibold">{order.store?.name}</div>
                            <div className="text-muted">
                              {order.store?.address} · {order.store?.landmark}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin size={13} className="mt-0.5 shrink-0 text-coral" />
                          <div>
                            <div className="font-semibold">{order.address}</div>
                            <div className="text-muted">
                              {order.landmark}
                              {order.notes ? ` · “${order.notes}”` : ""}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                        <a
                          href={`tel:${order.customerPhone.replace(/\s/g, "")}`}
                          className="btn btn-ghost btn-sm"
                        >
                          <Phone size={13} /> Customer
                        </a>
                        {action ? (
                          <button
                            type="button"
                            onClick={() => advance(order)}
                            disabled={busy === order.id || !online}
                            className={`btn btn-sm flex-1 ${
                              action.status === "delivered" ? "btn-saffron" : "btn-primary"
                            } disabled:opacity-50`}
                          >
                            <action.icon size={13} />
                            {action.label}
                            <ChevronRight size={13} />
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
                {!active.length ? (
                  <div className="rounded-[10px] border border-dashed border-line px-4 py-8 text-center">
                    <div className="grid place-items-center text-brand/60"><Bike size={26} /></div>
                    <div className="mt-2 text-sm font-semibold">No active deliveries</div>
                    <p className="mt-1 text-[11px] text-muted">
                      Dispatch will assign an order when one is ready in {driver.citySlug}.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-4 rounded-[10px] border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
                No orders assigned to you yet.
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4" id="cash">
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-[-0.04em]">COD wallet</h2>
              <Banknote size={19} className="text-brand" />
            </div>
            <div className="mt-4 rounded-[10px] bg-ink p-4 text-on-dark">
              <div className="text-[11px] font-medium text-on-dark/40">
                Cash currently with you
              </div>
              <div className="mt-1 text-3xl font-semibold tracking-[-0.05em]">
                {money(driver.cashOnHand)}
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface/15">
                <div
                  className="h-full rounded-full bg-saffron"
                  style={{
                    width: `${Math.min(100, Math.round((driver.cashOnHand / driver.cashLimit) * 100))}%`,
                  }}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-[11px] font-bold text-on-dark/40">
                <span>Limit {money(driver.cashLimit)}</span>
                <span>{money(cashLeft)} left</span>
              </div>
            </div>
            <div className="mt-3 space-y-2 text-[11px]">
              <div className="flex justify-between text-muted">
                <span>Delivery earnings (est.)</span>
                <span className="font-semibold text-ink">{money(earnings)}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>Cash liability</span>
                <span className="font-semibold text-danger">{money(driver.cashOnHand)}</span>
              </div>
              <div className="flex justify-between border-t border-line pt-2 text-sm font-semibold">
                <span>Net position</span>
                <span>{money(earnings - driver.cashOnHand)}</span>
              </div>
            </div>
            <div className="mt-3 rounded-[6px] bg-saffron/15 p-3 text-[11px] leading-5 font-bold text-muted">
              Cash is settled with dispatch at the end of your shift. Earnings are
              separate from the cash you carry.
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Live city queue</h2>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-brand">
                <span className="status-dot live-dot text-brand" /> Live
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted">
              Orders in {driver.citySlug}. Accept a ready order to start your route.
            </p>
            <div className="mt-3 space-y-2">
              {cityOrders.length ? (
                cityOrders.slice(0, 6).map((order) => (
                  <div
                    key={order.id}
                    data-order-id={order.id}
                    className="rounded-[6px] bg-surface-2 px-3 py-2.5 text-[11px]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">
                          {order.store?.name || "Store"}
                        </div>
                        <div className="text-[11px] text-muted">
                          {order.code} · {STATUS_META[order.status].label} ·{" "}
                          {timeAgo(order.createdAt)}
                        </div>
                      </div>
                      <span className="shrink-0 font-semibold">
                        {money(order.total)}
                      </span>
                    </div>
                    {order.status === "ready" ? (
                      <button
                        type="button"
                        onClick={() => void claim(order)}
                        disabled={busy === order.id || !canClaim}
                        className="btn btn-primary btn-sm mt-2 w-full disabled:opacity"
                      >
                        <Bike size={13} />
                        {busy === order.id
                          ? "Accepting…"
                          : canClaim
                            ? "Accept delivery"
                            : driver.status === "busy"
                              ? "Finish your current route first"
                              : "Go online to accept"}
                      </button>
                    ) : (
                      <div className="mt-2 text-[11px] font-bold text-muted">
                        Waiting for the store to mark it ready
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="rounded-[6px] border border-dashed border-line px-3 py-6 text-center text-[11px] text-muted">
                  No live orders in {driver.citySlug} right now. This panel updates
                  automatically.
                </div>
              )}
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Delivered today</h2>
              <CheckCircle2 size={17} className="text-brand" />
            </div>
            <div className="mt-3 space-y-2">
              {history.length ? (
                history.map((order) => (
                  <div key={order.id} className="flex items-center justify-between gap-2 text-[11px]">
                    <div className="min-w-0">
                      <div className="truncate font-bold text-muted">{order.store?.name}</div>
                      <div className="text-[11px] text-muted">
                        {order.deliveredAt ? clock(order.deliveredAt) : ""} · {order.code}
                      </div>
                    </div>
                    <span className="shrink-0 font-semibold">{money(order.total)}</span>
                  </div>
                ))
              ) : (
                <div className="text-[11px] text-muted">No deliveries completed yet.</div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-[6px] bg-ink px-4 py-2.5 text-[12px] font-medium text-on-dark shadow-[var(--shadow-float)]">
          {toast}
        </div>
      ) : null}

      {codeFor ? (
        <HandoverPrompt
          title="Complete this delivery"
          description="Ask the customer for the four digits on their order screen. Enter them to hand over the order and collect the cash."
          busy={busy === codeFor.id}
          error={codeError}
          onClose={() => {
            setCodeFor(null);
            setCodeError("");
          }}
          onSubmit={(code) => advance(codeFor, code)}
        />
      ) : null}
    </div>
  );
}
