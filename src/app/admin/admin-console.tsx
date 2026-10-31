"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  Bike,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  MapPin,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Database,
  History,
  Loader2,
  Lock,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Star,
  Store as StoreIcon,
  Truck,
  Users,
  UtensilsCrossed,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import type { AdminUserView, OrderView } from "@/lib/db";
import { storePhoto } from "@/lib/store-images";
import type {
  AuditEntry,
  City,
  Driver,
  OrderStatus,
  PlatformSettings,
  Store,
  StoreCategory,
} from "@/lib/types";
import type { DataSourceStatus } from "@/lib/data-source";
import { getOpenState } from "@/lib/hours";
import { availableTransitions } from "@/lib/order-machine";
import { STATUS_META } from "@/lib/types";
import { categoryLabel, money, timeAgo } from "@/lib/utils";
import { MapView, type MapPoint } from "@/components/map-view";
import { useLiveEvents } from "@/lib/use-live-events";

type Stats = {
  ordersToday: number;
  liveOrders: number;
  delivered: number;
  gmv: number;
  stores: number;
  drivers: number;
  onlineDrivers: number;
  cities: number;
  liveCities: number;
};

type Tab =
  | "overview"
  | "orders"
  | "stores"
  | "drivers"
  | "cities"
  | "activity"
  | "data"
  | "settings";

type StoreDraft = {
  name: string;
  nameAr: string;
  citySlug: string;
  category: StoreCategory;
  tagline: string;
  address: string;
  landmark: string;
  lat: string;
  lng: string;
  prepTime: string;
  minOrder: string;
  deliveryFee: string;
  phone: string;
  ownerName: string;
  isOpen: boolean;
};

const TABS: { id: Tab; label: string; icon: typeof MapPin }[] = [
  { id: "overview", label: "Live overview", icon: Zap },
  { id: "orders", label: "Orders", icon: PackageCheck },
  { id: "stores", label: "Stores", icon: StoreIcon },
  { id: "drivers", label: "Drivers", icon: Bike },
  { id: "cities", label: "Cities", icon: Building2 },
  { id: "activity", label: "Activity", icon: History },
  { id: "data", label: "Data sources", icon: Database },
  { id: "settings", label: "Settings", icon: Settings2 },
];

export function AdminConsole({
  initialOrders,
  initialStores,
  initialDrivers,
  initialUsers,
  initialCities,
  initialSettings,
  initialStats,
  initialAuditLogs,
  initialDataSource,
}: {
  initialOrders: OrderView[];
  initialStores: Store[];
  initialDrivers: Driver[];
  initialUsers: AdminUserView[];
  initialCities: City[];
  initialSettings: PlatformSettings;
  initialStats: Stats;
  initialAuditLogs: AuditEntry[];
  initialDataSource: DataSourceStatus;
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [stores, setStores] = useState(initialStores);
  const [drivers, setDrivers] = useState(initialDrivers);
  const [users, setUsers] = useState(initialUsers);
  const [cities, setCities] = useState(initialCities);
  const [settings, setSettings] = useState(initialSettings);
  const [stats, setStats] = useState(initialStats);
  const [auditLogs, setAuditLogs] = useState(initialAuditLogs);
  const [dataSource, setDataSource] = useState(initialDataSource);
  const [activityEntity, setActivityEntity] = useState("all");
  const [cancelTarget, setCancelTarget] = useState<OrderView | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [cityQuery, setCityQuery] = useState("");
  const [cityFilter, setCityFilter] = useState<"priority" | "live" | "all">("priority");
  const [driverChoice, setDriverChoice] = useState<Record<string, string>>({});
  const [storeFormOpen, setStoreFormOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);

  const pendingUsers = useMemo(
    () => users.filter((user) => (user.accountStatus ?? "active") === "pending"),
    [users],
  );

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const response = await fetch("/api/admin/state", { cache: "no-store" });
      if (response.ok) {
        const data = (await response.json()) as {
          orders: OrderView[];
          stores: Store[];
          drivers: Driver[];
          users: AdminUserView[];
          cities: City[];
          settings: PlatformSettings;
          stats: Stats;
          auditLogs: AuditEntry[];
          dataSource: DataSourceStatus;
        };
        setOrders(
          [...data.orders].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          ),
        );
        setStores(data.stores);
        setDrivers(data.drivers);
        setUsers(data.users);
        setCities(data.cities);
        setSettings(data.settings);
        setStats(data.stats);
        setAuditLogs(data.auditLogs);
        setDataSource(data.dataSource);
      }
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, []);

  useLiveEvents({ type: "", excludeType: "location" }, () => {
    void refresh(true);
  });

  useEffect(() => {
    const timer = window.setInterval(() => refresh(true), 10000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const apply = () => {
      const hash = window.location.hash.replace("#", "");
      if (TABS.some((item) => item.id === hash)) setTab(hash as Tab);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  const activeOrders = useMemo(
    () => orders.filter((order) => !["delivered", "cancelled"].includes(order.status)),
    [orders],
  );

  async function assign(orderId: string, driverId?: string, auto = false) {
    setBusy(orderId);
    try {
      const response = await fetch(`/api/orders/${orderId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(auto ? { auto: true } : { driverId }),
      });
      const data = (await response.json()) as { error?: string; order?: OrderView };
      if (!response.ok) {
        setToast(data.error || "Could not assign a driver");
        return;
      }
      setToast(auto ? "Nearest driver auto-assigned" : "Driver assigned");
      await refresh(true);
    } finally {
      setBusy("");
    }
  }

  async function setStatus(orderId: string, status: OrderStatus, note?: string) {
    setBusy(orderId);
    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setToast(data.error || "Could not update the order");
        return false;
      }
      setToast(`Order marked ${STATUS_META[status].label.toLowerCase()}`);
      await refresh(true);
      return true;
    } finally {
      setBusy("");
    }
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    const ok = await setStatus(cancelTarget.id, "cancelled", cancelReason.trim());
    if (ok) {
      setCancelTarget(null);
      setCancelReason("");
    }
  }

  async function verifyDataSource() {
    setBusy("data");
    try {
      const response = await fetch("/api/admin/data-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify" }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        integrity?: DataSourceStatus["integrity"];
        error?: string;
      };
      if (!response.ok) {
        setToast(data.error || "Could not verify the snapshot");
        return;
      }
      setDataSource((current) => ({
        ...current,
        integrity: data.integrity ?? current.integrity,
      }));
      setToast(data.ok ? "Snapshot checksum is valid" : "Checksum mismatch — re-run the importer");
    } finally {
      setBusy("");
    }
  }

  async function refreshDataSource() {
    setBusy("data");
    try {
      const response = await fetch("/api/admin/data-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refresh" }),
      });
      const data = (await response.json()) as { error?: string };
      setToast(
        response.ok
          ? "Directory refreshed"
          : data.error || "Refresh is not available for a locked snapshot",
      );
    } finally {
      setBusy("");
    }
  }

  function requestStatus(order: OrderView, status: OrderStatus) {
    if (status === "cancelled") {
      setCancelTarget(order);
      setCancelReason("");
      return;
    }
    void setStatus(order.id, status);
  }

  async function toggleStore(store: Store) {
    setBusy(store.id);
    try {
      const response = await fetch("/api/merchant/store", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: store.id, isOpen: !store.isOpen }),
      });
      if (response.ok) {
        setStores((current) =>
          current.map((item) =>
            item.id === store.id ? { ...item, isOpen: !item.isOpen } : item,
          ),
        );
        setToast(`${store.name} ${store.isOpen ? "paused" : "opened"}`);
      }
    } finally {
      setBusy("");
    }
  }

  async function toggleCity(city: City) {
    setBusy(city.id);
    try {
      const next = city.launchStatus === "live" ? "soon" : "live";
      const response = await fetch("/api/admin/cities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cityId: city.id, launchStatus: next }),
      });
      if (response.ok) {
        setCities((current) =>
          current.map((item) => (item.id === city.id ? { ...item, launchStatus: next } : item)),
        );
        setToast(`${city.name} is now ${next === "live" ? "live" : "coming soon"}`);
      }
    } finally {
      setBusy("");
    }
  }

  async function saveDriver(
    driver: Driver,
    patch: {
      vehicle: string;
      plate: string;
      phone: string;
      cashLimit: number;
      active: boolean;
      resetCash: boolean;
      status: Driver["status"];
    },
  ) {
    setBusy(driver.id);
    try {
      const response = await fetch("/api/admin/drivers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId: driver.id, ...patch }),
      });
      const data = (await response.json()) as { error?: string; driver?: Driver };
      if (!response.ok || !data.driver) {
        setToast(data.error || "Could not update the driver");
        return;
      }
      setDrivers((current) =>
        current.map((item) => (item.id === data.driver!.id ? data.driver! : item)),
      );
      setEditingDriver(null);
      setToast(`${data.driver.name} updated`);
      await refresh(true);
    } finally {
      setBusy("");
    }
  }

  async function saveStore(
    draft: StoreDraft,
    store?: Store,
  ): Promise<boolean> {
    setBusy(store?.id ?? "new-store");
    try {
      const response = await fetch("/api/admin/stores", {
        method: store ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          store ? { storeId: store.id, patch: draft } : draft,
        ),
      });
      const data = (await response.json()) as { error?: string; store?: Store };
      if (!response.ok || !data.store) {
        setToast(data.error || "Could not save the store");
        return false;
      }
      setToast(store ? `${data.store.name} updated` : `${data.store.name} added`);
      await refresh(true);
      return true;
    } finally {
      setBusy("");
    }
  }

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault();
    setBusy("settings");
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = (await response.json()) as { error?: string; settings?: PlatformSettings };
      if (!response.ok || !data.settings) {
        setToast(data.error || "Could not save settings");
        return;
      }
      setSettings(data.settings);
      setToast("Platform settings saved");
    } finally {
      setBusy("");
    }
  }

  async function resetDemo() {
    if (!window.confirm("Reset all demo orders, drivers and settings to the seed data?")) return;
    setBusy("reset");
    try {
      const response = await fetch("/api/admin/reset", { method: "POST" });
      if (response.ok) {
        await refresh(true);
        setToast("Demo data reset");
      }
    } finally {
      setBusy("");
    }
  }

  const mapPoints = useMemo<MapPoint[]>(() => {
    const points: MapPoint[] = [];
    for (const order of activeOrders.slice(0, 12)) {
      if (order.store) {
        points.push({
          id: `s-${order.id}`,
          lat: order.store.lat,
          lng: order.store.lng,
          kind: "store",
          label: order.store.name,
        });
      }
      points.push({
        id: `c-${order.id}`,
        lat: order.lat,
        lng: order.lng,
        kind: "customer",
        label: order.address,
      });
      if (order.driver) {
        points.push({
          id: `d-${order.driver.id}`,
          lat: order.driver.lat,
          lng: order.driver.lng,
          kind: "driver",
          label: order.driver.name,
        });
      }
    }
    if (!points.length) {
      points.push({
        id: "dakhla",
        lat: 23.6848,
        lng: -15.958,
        kind: "store",
        label: "Dakhla operations",
      });
    }
    return points;
  }, [activeOrders]);

  const cityList = useMemo(() => {
    const term = cityQuery.trim().toLowerCase();
    return cities
      .filter((city) => {
        if (cityFilter === "priority") return city.priority;
        if (cityFilter === "live") return city.launchStatus === "live";
        return true;
      })
      .filter((city) =>
        term ? `${city.name} ${city.nameAr} ${city.region}`.toLowerCase().includes(term) : true,
      )
      .slice(0, 60);
  }, [cities, cityQuery, cityFilter]);

  const statsCards = [
    { label: "Live orders", value: `${stats.liveOrders}` },
    { label: "Delivered GMV", value: money(stats.gmv) },
    { label: "Online drivers", value: `${stats.onlineDrivers}/${stats.drivers}` },
    { label: "Live cities", value: `${stats.liveCities}/${stats.cities}` },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="eyebrow">Platform operations · {settings.brandName}</div>
          <h1 className="display mt-2 text-[clamp(2rem,1.5rem+1.8vw,3rem)]">Dispatch control room.</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted">
            <span className="inline-flex items-center gap-1">
              <span className="status-dot live-dot text-teal" /> Live across {stats.liveCities} cities
            </span>
            <span className="inline-flex items-center gap-1">
              <Users size={12} className="text-teal" /> {stats.stores} stores
            </span>
            <span className="inline-flex items-center gap-1">
              <Truck size={12} className="text-teal" /> {activeOrders.length} orders in flight
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/accounts"
            className="btn btn-ghost relative"
          >
            <Users size={14} /> Accounts
            {pendingUsers.length ? (
              <span className="ms-1 grid h-5 min-w-5 place-items-center rounded-full bg-coral px-1 text-[11px] font-extrabold text-on-dark">
                {pendingUsers.length}
              </span>
            ) : null}
          </Link>
          <button type="button" onClick={() => refresh()} className="btn btn-ghost">
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh
          </button>
          <button
            type="button"
            onClick={resetDemo}
            disabled={busy === "reset"}
            className="btn btn-danger"
          >
            <RotateCcw size={14} /> Reset demo
          </button>
        </div>
      </div>

      {pendingUsers.length ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-saffron/30 bg-saffron/10 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-saffron/25 text-saffron-deep">
              <Users size={16} />
            </span>
            <div>
              <div className="text-[13px] font-extrabold">
                {pendingUsers.length} account{pendingUsers.length === 1 ? "" : "s"} waiting
                for approval
              </div>
              <div className="text-[11px] font-bold text-ink/45">
                Approving a store owner provisions a storefront. Approving a driver
                provisions a courier profile.
              </div>
            </div>
          </div>
          <Link href="/admin/accounts" className="btn btn-primary btn-sm">
            Review accounts <CheckCircle2 size={13} />
          </Link>
        </div>
      ) : null}

      <div className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-line pt-4 lg:grid-cols-4">
        {statsCards.map((item) => (
          <div key={item.label}>
            <div className="text-[11px] text-muted">{item.label}</div>
            <div className="mt-1.5 font-display text-[28px] font-semibold leading-none tracking-[-0.03em] tnum">
              {item.value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-7 flex gap-5 overflow-x-auto border-b border-line scrollbar-none">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`relative inline-flex items-center gap-2 whitespace-nowrap px-0.5 pb-2.5 pt-1 text-[13px] transition-colors ${
              tab === item.id
                ? "font-semibold text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-brand"
                : "text-muted hover:text-ink"
            }`}
          >
            <item.icon size={14} />
            {item.label}
          </button>
        ))}
      </div>

      {toast ? (
        <div className="fixed bottom-6 start-1/2 z-50 -translate-x-1/2 rounded-[6px] bg-ink px-4 py-2 text-[13px] font-medium text-on-dark shadow-lg rtl:translate-x-1/2">
          {toast}
        </div>
      ) : null}

      {cancelTarget ? (
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-ink/50 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => setCancelTarget(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Cancel order"
            className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-red-50 text-red-500">
                <AlertTriangle size={17} />
              </span>
              <div>
                <h2 className="text-base font-extrabold">Cancel {cancelTarget.code}?</h2>
                <p className="text-[11px] font-bold text-ink/40">
                  The reason is saved on the order and in the activity trail.
                </p>
              </div>
            </div>
            <textarea
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              className="input mt-4 min-h-24 resize-none"
              placeholder="e.g. Store ran out of the main dish and called the customer"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="btn btn-ghost btn-sm"
              >
                Keep order
              </button>
              <button
                type="button"
                onClick={confirmCancel}
                disabled={cancelReason.trim().length < 3 || busy === cancelTarget.id}
                className="btn btn-sm bg-red-600 text-on-dark disabled:opacity-40"
              >
                Cancel order
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {storeFormOpen ? (
        <StoreFormModal
          store={editingStore}
          cities={cities}
          busy={busy === (editingStore?.id ?? "new-store")}
          onClose={() => {
            setStoreFormOpen(false);
            setEditingStore(null);
          }}
          onSave={async (draft) => {
            const ok = await saveStore(draft, editingStore ?? undefined);
            if (ok) {
              setStoreFormOpen(false);
              setEditingStore(null);
            }
          }}
        />
      ) : null}

      {editingDriver ? (
        <DriverEditModal
          driver={editingDriver}
          busy={busy === editingDriver.id}
          onClose={() => setEditingDriver(null)}
          onSave={(patch) => saveDriver(editingDriver, patch)}
        />
      ) : null}

      {tab === "overview" ? (
        <section className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div className="card overflow-hidden">
            <MapView points={mapPoints} zoom={12} height={420} />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/8 bg-paper px-4 py-3">
              <div className="flex items-center gap-2 text-[11px] font-bold text-ink/45">
                <span className="status-dot live-dot text-teal" />
                {mapPoints.length} live markers · updated in real time
              </div>
              <div className="flex flex-wrap gap-3 text-[11px] font-medium text-ink/35">
                <span className="inline-flex items-center gap-1">
                  <StoreIcon size={10} /> store
                </span>
                <span className="inline-flex items-center gap-1">
                  <Bike size={10} /> driver
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin size={10} /> customer
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {activeOrders.slice(0, 6).map((order) => (
              <AdminOrderCard
                key={order.id}
                order={order}
                compact
                drivers={drivers.filter((driver) => driver.citySlug === order.citySlug)}
                busy={busy === order.id}
                chosenDriver={driverChoice[order.id]}
                onChooseDriver={(driverId) =>
                  setDriverChoice((current) => ({ ...current, [order.id]: driverId }))
                }
                onAssign={() => assign(order.id, driverChoice[order.id])}
                onAuto={() => assign(order.id, undefined, true)}
                onStatus={(status) => requestStatus(order, status)}
              />
            ))}
            {!activeOrders.length ? (
              <div className="card grid place-items-center px-6 py-14 text-center">
                <CheckCircle2 size={28} className="text-teal" />
                <h3 className="mt-3 text-lg font-extrabold">All clear</h3>
                <p className="mt-1 text-sm text-ink/45">No live orders right now.</p>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {tab === "orders" ? (
        <section className="mt-4" id="orders">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold tracking-[-0.04em]">All orders</h2>
            <span className="text-[11px] font-bold text-ink/35">{orders.length} total</span>
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {orders.map((order) => (
              <AdminOrderCard
                key={order.id}
                order={order}
                drivers={drivers.filter((driver) => driver.citySlug === order.citySlug)}
                busy={busy === order.id}
                chosenDriver={driverChoice[order.id]}
                onChooseDriver={(driverId) =>
                  setDriverChoice((current) => ({ ...current, [order.id]: driverId }))
                }
                onAssign={() => assign(order.id, driverChoice[order.id])}
                onAuto={() => assign(order.id, undefined, true)}
                onStatus={(status) => requestStatus(order, status)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {tab === "stores" ? (
        <section className="mt-4" id="stores">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold tracking-[-0.04em]">Stores & supply</h2>
              <p className="mt-1 text-[11px] text-ink/40">
                Add a partner, edit its details or toggle it open and closed.
                Merchants keep their own dashboard.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="pill">{stores.length} partners</span>
              <button
                type="button"
                onClick={() => {
                  setEditingStore(null);
                  setStoreFormOpen(true);
                }}
                className="btn btn-primary btn-sm"
              >
                <Plus size={13} /> Add store
              </button>
            </div>
          </div>
          <div className="card mt-3 overflow-hidden">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Store</th>
                    <th>City</th>
                    <th>Category</th>
                    <th>Rating</th>
                    <th>Fee</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {stores.map((store) => {
                    const openState = getOpenState(store);
                    return (
                      <tr key={store.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-cream">
                            <Image
                              src={storePhoto(store)}
                              alt=""
                              fill
                              sizes="32px"
                              className="object-cover"
                            />
                          </span>
                          <div>
                            <div className="font-extrabold">{store.name}</div>
                            <div className="text-[11px] text-ink/35">{store.landmark}</div>
                          </div>
                        </div>
                      </td>
                      <td className="text-ink/50">{store.citySlug}</td>
                      <td className="text-ink/50">{categoryLabel(store.category)}</td>
                      <td className="font-extrabold">{store.rating}</td>
                      <td className="font-extrabold">{money(store.deliveryFee)}</td>
                      <td>
                        <span
                          className={`rounded-full px-2 py-1 text-[11px] font-extrabold uppercase ${
                            openState.open ? "bg-teal/10 text-teal" : "bg-red-50 text-red-500"
                          }`}
                        >
                          {openState.open ? "Open" : "Closed"}
                        </span>
                        <div className="mt-1 text-[11px] font-bold text-ink/35">
                          {openState.detail}
                        </div>
                      </td>
                      <td className="text-end">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingStore(store);
                              setStoreFormOpen(true);
                            }}
                            disabled={busy === store.id}
                            className="btn btn-ghost btn-sm"
                          >
                            <Pencil size={11} /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleStore(store)}
                            disabled={busy === store.id}
                            className="btn btn-ghost btn-sm"
                          >
                            {store.isOpen ? "Pause" : "Open"}
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      {tab === "drivers" ? (
        <section className="mt-4" id="drivers">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-xl font-extrabold tracking-[-0.04em]">Driver fleet</h2>
              <p className="mt-1 text-[11px] text-ink/40">
                Cash on hand is COD liability. Drivers at their limit cannot be assigned.
              </p>
            </div>
            <span className="pill">{stats.onlineDrivers} online</span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {drivers.map((driver) => {
              const ratio = Math.min(100, Math.round((driver.cashOnHand / driver.cashLimit) * 100));
              return (
                <article key={driver.id} className="card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal/10 text-teal">
                        <Bike size={17} />
                      </span>
                      <div>
                        <div className="text-[13px] font-extrabold">{driver.name}</div>
                        <div className="text-[11px] font-bold text-ink/35">
                          {driver.citySlug} · {driver.vehicle}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-extrabold uppercase ${
                        !driver.active
                          ? "bg-red-50 text-red-500"
                          : driver.status === "available"
                            ? "bg-teal/10 text-teal"
                            : driver.status === "busy"
                              ? "bg-saffron/20 text-ink"
                              : "bg-ink/5 text-ink/40"
                      }`}
                    >
                      {driver.active ? driver.status : "inactive"}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] font-bold text-ink/40">
                    <span>{driver.deliveries} deliveries</span>
                    <span className="inline-flex items-center gap-1"><Star size={11} className="fill-saffron text-saffron" /> {driver.rating}</span>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-[11px] font-extrabold">
                      <span className="text-ink/40">Cash on hand</span>
                      <span className={ratio > 85 ? "text-red-500" : "text-ink"}>
                        {money(driver.cashOnHand)} / {money(driver.cashLimit)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink/8">
                      <div
                        className={`h-full rounded-full ${ratio > 85 ? "bg-red-500" : "bg-teal"}`}
                        style={{ width: `${ratio}%` }}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-ink/30">
                      <MapPin size={10} /> {driver.lat.toFixed(4)}, {driver.lng.toFixed(4)}
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingDriver(driver)}
                      className="btn btn-ghost btn-sm"
                    >
                      <Pencil size={11} /> Manage
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {tab === "cities" ? (
        <section className="mt-4" id="cities">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold tracking-[-0.04em]">City activation</h2>
              <p className="mt-1 text-[11px] text-ink/40">
                Every Moroccan city is listed. Switch a city live when supply is ready.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search
                  size={14}
                  className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink/30"
                />
                <input
                  value={cityQuery}
                  onChange={(event) => setCityQuery(event.target.value)}
                  placeholder="Search cities…"
                  className="input h-9 w-52 ps-8 text-xs"
                />
              </div>
              {[
                { value: "priority" as const, label: "Priority" },
                { value: "live" as const, label: "Live" },
                { value: "all" as const, label: "All" },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setCityFilter(item.value)}
                  className={`rounded-xl border px-3 py-1.5 text-[11px] font-extrabold transition ${
                    cityFilter === item.value
                      ? "border-ink bg-ink text-on-dark"
                      : "border-ink/10 bg-white/60 text-ink/50"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card mt-3 overflow-hidden">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>City</th>
                    <th>Region</th>
                    <th>Population</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {cityList.map((city) => (
                    <tr key={city.id}>
                      <td>
                        <div className="font-extrabold">{city.name}</div>
                        <div className="arabic text-[11px] text-ink/35">{city.nameAr}</div>
                      </td>
                      <td className="text-ink/45">{city.region}</td>
                      <td className="text-ink/45">
                        {city.population ? city.population.toLocaleString("en-US") : "—"}
                      </td>
                      <td>
                        {city.priority ? (
                          <span className="pill pill-warm">Priority</span>
                        ) : (
                          <span className="text-[11px] text-ink/25">—</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`rounded-full px-2 py-1 text-[11px] font-extrabold uppercase ${
                            city.launchStatus === "live"
                              ? "bg-teal/10 text-teal"
                              : "bg-ink/5 text-ink/40"
                          }`}
                        >
                          {city.launchStatus}
                        </span>
                      </td>
                      <td className="text-end">
                        <button
                          type="button"
                          onClick={() => toggleCity(city)}
                          disabled={busy === city.id}
                          className="btn btn-ghost btn-sm"
                        >
                          {city.launchStatus === "live" ? "Set soon" : "Go live"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!cityList.length ? (
              <div className="px-4 py-10 text-center text-sm text-ink/40">No cities match.</div>
            ) : null}
          </div>
        </section>
      ) : null}

      {tab === "activity" ? (
        <section className="mt-4" id="activity">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold tracking-[-0.04em]">Activity trail</h2>
              <p className="mt-1 text-[11px] text-ink/40">
                Every status change, assignment and configuration edit is attributed to
                the signed-in actor and kept for the last {auditLogs.length} events.
              </p>
            </div>
            <select
              value={activityEntity}
              onChange={(event) => setActivityEntity(event.target.value)}
              className="h-9 rounded-xl border border-ink/10 bg-white px-3 text-[11px] font-bold"
              aria-label="Filter activity"
            >
              {["all", "order", "store", "product", "driver", "city", "settings"].map(
                (entity) => (
                  <option key={entity} value={entity}>
                    {entity === "all" ? "All entities" : entity}
                  </option>
                ),
              )}
            </select>
          </div>

          <div className="card mt-3 overflow-hidden">
            <div className="divide-y divide-ink/6">
              {auditLogs
                .filter((entry) =>
                  activityEntity === "all" ? true : entry.entity === activityEntity,
                )
                .map((entry) => (
                  <div key={entry.id} className="flex gap-3 p-4">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cream text-teal">
                      <EntityIcon entity={entry.entity} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-extrabold">{entry.summary}</span>
                        {entry.before || entry.after ? (
                          <span className="rounded-md bg-ink/5 px-1.5 py-0.5 text-[11px] font-bold text-ink/40">
                            {entry.before} → {entry.after}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold text-ink/35">
                        <span className="rounded-full bg-teal/8 px-2 py-0.5 uppercase tracking-wide text-teal">
                          {entry.actorRole}
                        </span>
                        <span>{entry.actorName || entry.actorId || "system"}</span>
                        <span>·</span>
                        <span>{entry.action}</span>
                        <span>·</span>
                        <span>{timeAgo(entry.at)}</span>
                      </div>
                      {entry.note ? (
                        <p className="mt-1 text-[11px] italic text-ink/40">“{entry.note}”</p>
                      ) : null}
                    </div>
                  </div>
                ))}
              {!auditLogs.filter((entry) =>
                activityEntity === "all" ? true : entry.entity === activityEntity,
              ).length ? (
                <div className="px-4 py-12 text-center text-sm text-ink/40">
                  No activity recorded for this entity yet.
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {tab === "data" ? (
        <section className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]" id="data">
          <div className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-extrabold tracking-[-0.04em]">Restaurant data</h2>
                <p className="mt-1 text-[11px] leading-5 text-ink/40">
                  The directory is a sealed snapshot. Menus and prices are authored demo
                  content and cannot be edited at runtime.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-3 py-1.5 text-[11px] font-medium text-ink/50">
                <Lock size={10} /> {dataSource.locked ? "Locked" : "Live"}
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-cream/70 p-3">
                <div className="text-[11px] font-medium text-ink/35">
                  Restaurants
                </div>
                <div className="mt-1 text-2xl font-extrabold">{dataSource.restaurantCount}</div>
              </div>
              <div className="rounded-2xl bg-cream/70 p-3">
                <div className="text-[11px] font-medium text-ink/35">
                  Menu items
                </div>
                <div className="mt-1 text-2xl font-extrabold">{dataSource.menuItemCount}</div>
              </div>
              <div className="rounded-2xl bg-cream/70 p-3">
                <div className="text-[11px] font-medium text-ink/35">
                  Cities
                </div>
                <div className="mt-1 text-2xl font-extrabold">
                  {Object.keys(dataSource.cityCounts).length}
                </div>
              </div>
            </div>

            <div
              className={`mt-4 rounded-2xl border p-4 ${
                dataSource.integrity.ok
                  ? "border-teal/20 bg-teal/5"
                  : "border-eed-200 bg-red-50"
              }`}
            >
              <div className="flex items-center gap-2 text-[11px] font-extrabold">
                <ShieldCheck
                  size={14}
                  className={dataSource.integrity.ok ? "text-teal" : "text-red-500"}
                />
                {dataSource.integrity.ok
                  ? "Snapshot checksum verified"
                  : "Snapshot checksum mismatch"}
              </div>
              <div className="mt-1 break-all font-mono text-[11px] text-ink/40">
                sha256:{dataSource.integrity.actual}
              </div>
              <div className="mt-1 text-[11px] text-ink/40">
                Generated{" "}
                {new Date(dataSource.generatedAt).toLocaleString("en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
                {" · "}
                Provider {dataSource.activeProvider}
                {" · "}
                {dataSource.liveKeyConfigured
                  ? "MarocAPIs key present on this server"
                  : "No MarocAPIs key on this server"}
              </div>
            </div>

            <p className="mt-4 rounded-xl bg-saffron/10 p-3 text-[11px] leading-5 text-ink/50">
              {dataSource.notice}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={verifyDataSource}
                disabled={busy === "data"}
                className="btn btn-ghost btn-sm"
              >
                <ShieldCheck size={13} /> Verify checksum
              </button>
              <button
                type="button"
                onClick={refreshDataSource}
                disabled={busy === "data"}
                className="btn btn-ghost btn-sm"
              >
                <RefreshCw size={13} /> Refresh from source
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="card p-5">
              <h3 className="text-sm font-extrabold">Sources & licences</h3>
              <div className="mt-3 space-y-3">
                {dataSource.sources.map((source) => (
                  <div key={source.id} className="rounded-xl border border-ink/8 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-[11px] font-extrabold text-teal hover:underline"
                      >
                        {source.name} ↗
                      </a>
                      <span className="text-[11px] font-bold uppercase tracking-wide text-ink/30">
                        {source.id}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] font-bold text-ink/50">{source.role}</div>
                    <div className="mt-0.5 text-[11px] text-ink/35">{source.license}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <h3 className="text-sm font-extrabold">Coverage by city</h3>
              <div className="mt-3 space-y-1.5">
                {Object.entries(dataSource.cityCounts).map(([city, count]) => (
                  <div
                    key={city}
                    className="flex items-center justify-between text-[11px] font-bold"
                  >
                    <span className="capitalize text-ink/60">{city}</span>
                    <span className="rounded-lg bg-cream px-2 py-0.5 text-ink/50">
                      {count} restaurants
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-4 text-ink/35">
                Esmara has no restaurant records in the directory yet, so only preset
                partner stores are available there.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {tab === "settings" ? (
        <section className="mt-4 grid gap-4 lg:grid-cols-2" id="settings">
          <form onSubmit={saveSettings} className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold tracking-[-0.04em]">Platform settings</h2>
              <Settings2 size={18} className="text-teal" />
            </div>
            <p className="mt-1 text-[11px] text-ink/40">
              Brand, support and default economics. Store-level values override these.
            </p>
            <div className="mt-4 grid gap-3">
              <label className="block">
                <span className="label">Brand name</span>
                <input
                  value={settings.brandName}
                  onChange={(event) =>
                    setSettings({ ...settings, brandName: event.target.value })
                  }
                  className="input"
                />
              </label>
              <label className="block">
                <span className="label">Tagline</span>
                <input
                  value={settings.tagline}
                  onChange={(event) => setSettings({ ...settings, tagline: event.target.value })}
                  className="input"
                />
              </label>
              <label className="block">
                <span className="label">Support phone</span>
                <input
                  value={settings.supportPhone}
                  onChange={(event) =>
                    setSettings({ ...settings, supportPhone: event.target.value })
                  }
                  className="input"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="label">Commission %</span>
                  <input
                    type="number"
                    min={0}
                    max={40}
                    value={settings.commissionRate}
                    onChange={(event) =>
                      setSettings({ ...settings, commissionRate: Number(event.target.value) })
                    }
                    className="input"
                  />
                </label>
                <label className="block">
                  <span className="label">Default fee (MAD)</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={settings.defaultDeliveryFee}
                    onChange={(event) =>
                      setSettings({ ...settings, defaultDeliveryFee: Number(event.target.value) })
                    }
                    className="input"
                  />
                </label>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-cream p-3">
                <div>
                  <div className="text-[11px] font-extrabold">City waitlist</div>
                  <div className="text-[11px] text-ink/40">
                    Accept store and driver applications in coming-soon cities.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSettings({
                      ...settings,
                      cityWaitlistEnabled: !settings.cityWaitlistEnabled,
                    })
                  }
                  className={`relative h-7 w-12 rounded-full transition ${
                    settings.cityWaitlistEnabled ? "bg-teal" : "bg-ink/20"
                  }`}
                  aria-label="Toggle waitlist"
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                      settings.cityWaitlistEnabled ? "start-6" : "start-1"
                    }`}
                  />
                </button>
              </div>
              <button
                type="submit"
                disabled={busy === "settings"}
                className="btn btn-primary mt-1"
              >
                <ShieldCheck size={15} /> Save settings
              </button>
            </div>
          </form>

          <div className="space-y-4">
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-extrabold tracking-[-0.04em]">COD reconciliation</h2>
                <Banknote size={18} className="text-teal" />
              </div>
              <div className="mt-4 space-y-2 text-[13px]">
                <div className="flex justify-between text-ink/45">
                  <span>Cash held by drivers</span>
                  <span className="font-extrabold text-ink">
                    {money(drivers.reduce((sum, driver) => sum + driver.cashOnHand, 0))}
                  </span>
                </div>
                <div className="flex justify-between text-ink/45">
                  <span>Delivered GMV</span>
                  <span className="font-extrabold text-ink">{money(stats.gmv)}</span>
                </div>
                <div className="flex justify-between text-ink/45">
                  <span>Platform commission ({settings.commissionRate}%)</span>
                  <span className="font-extrabold text-teal">
                    {money(Math.round((stats.gmv * settings.commissionRate) / 100))}
                  </span>
                </div>
                <div className="flex justify-between border-t border-ink/8 pt-2 text-base font-extrabold">
                  <span>Store payouts due</span>
                  <span>
                    {money(
                      stats.gmv - Math.round((stats.gmv * settings.commissionRate) / 100),
                    )}
                  </span>
                </div>
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-saffron/15 p-3 text-[11px] leading-5 font-bold text-ink/55">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                Weekly settlement run. A driver at their cash limit is blocked from new COD
                orders until they hand over cash.
              </div>
            </div>

            <div className="card p-5">
              <h2 className="text-sm font-extrabold">Danger zone</h2>
              <p className="mt-1 text-[11px] leading-5 text-ink/40">
                Reset restores the seeded stores, drivers, demo orders and settings. Use it
                before a demo run.
              </p>
              <button
                type="button"
                onClick={resetDemo}
                disabled={busy === "reset"}
                className="btn btn-danger mt-3 w-full"
              >
                <RotateCcw size={14} /> Reset demo data
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function EntityIcon({ entity }: { entity: AuditEntry["entity"] }) {
  if (entity === "order") return <PackageCheck size={15} />;
  if (entity === "store") return <StoreIcon size={15} />;
  if (entity === "driver") return <Bike size={15} />;
  if (entity === "city") return <Building2 size={15} />;
  if (entity === "product") return <UtensilsCrossed size={15} />;
  if (entity === "auth") return <Users size={15} />;
  return <Settings2 size={15} />;
}

function StoreFormModal({
  store,
  cities,
  busy,
  onClose,
  onSave,
}: {
  store: Store | null;
  cities: City[];
  busy: boolean;
  onClose: () => void;
  onSave: (draft: StoreDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<StoreDraft>(() => ({
    name: store?.name ?? "",
    nameAr: store?.nameAr ?? "",
    citySlug: store?.citySlug ?? cities.find((city) => city.priority)?.slug ?? cities[0]?.slug ?? "dakhla",
    category: store?.category ?? "restaurant",
    tagline: store?.tagline ?? "",
    address: store?.address ?? "",
    landmark: store?.landmark ?? "",
    lat: store ? String(store.lat) : "",
    lng: store ? String(store.lng) : "",
    prepTime: store ? String(store.prepTime) : "30",
    minOrder: store ? String(store.minOrder) : "30",
    deliveryFee: store ? String(store.deliveryFee) : "15",
    phone: store?.phone ?? "",
    ownerName: store?.ownerName ?? "",
    isOpen: store?.isOpen ?? false,
  }));
  const [error, setError] = useState("");

  function set<K extends keyof StoreDraft>(key: K, value: StoreDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (draft.name.trim().length < 2) {
      setError("Enter the store name");
      return;
    }
    setError("");
    await onSave(draft);
  }

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-ink/50 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label={store ? "Edit store" : "Add store"}
        className="my-6 w-full max-w-2xl rounded-3xl bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold tracking-[-0.04em]">
              {store ? "Edit store" : "Add a partner store"}
            </h2>
            <p className="mt-1 text-[11px] text-ink/40">
              The store is created closed so you can finish the setup before it goes live.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl border border-ink/10 text-ink/40 hover:text-ink"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">Store name</span>
            <input
              value={draft.name}
              onChange={(event) => set("name", event.target.value)}
              className="input"
              placeholder="e.g. Dakhla Grill"
              autoFocus
              required
            />
          </label>
          <label className="block">
            <span className="label">Arabic name</span>
            <input
              value={draft.nameAr}
              onChange={(event) => set("nameAr", event.target.value)}
              className="input arabic"
              placeholder="مثال: مطعم الداخلة"
            />
          </label>
          <label className="block">
            <span className="label">City</span>
            <select
              value={draft.citySlug}
              onChange={(event) => set("citySlug", event.target.value)}
              className="input"
              required
            >
              {cities.map((city) => (
                <option key={city.slug} value={city.slug}>
                  {city.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Category</span>
            <select
              value={draft.category}
              onChange={(event) => set("category", event.target.value as StoreCategory)}
              className="input"
            >
              <option value="restaurant">Restaurant</option>
              <option value="grocery">Grocery</option>
              <option value="pharmacy">Pharmacy</option>
              <option value="cafe">Café</option>
              <option value="gifts">Gifts</option>
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Tagline</span>
            <input
              value={draft.tagline}
              onChange={(event) => set("tagline", event.target.value)}
              className="input"
              placeholder="One line customers see on the card"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Address</span>
            <input
              value={draft.address}
              onChange={(event) => set("address", event.target.value)}
              className="input"
              placeholder="Street, building, neighbourhood"
            />
          </label>
          <label className="block">
            <span className="label">Landmark</span>
            <input
              value={draft.landmark}
              onChange={(event) => set("landmark", event.target.value)}
              className="input"
              placeholder="e.g. Boulevard Mohammed V"
            />
          </label>
          <label className="block">
            <span className="label">Phone</span>
            <input
              value={draft.phone}
              onChange={(event) => set("phone", event.target.value)}
              className="input"
              placeholder="+212 6…"
              inputMode="tel"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="label">Latitude</span>
              <input
                value={draft.lat}
                onChange={(event) => set("lat", event.target.value)}
                className="input"
                placeholder="City centre"
                inputMode="decimal"
              />
            </label>
            <label className="block">
              <span className="label">Longitude</span>
              <input
                value={draft.lng}
                onChange={(event) => set("lng", event.target.value)}
                className="input"
                placeholder="City centre"
                inputMode="decimal"
              />
            </label>
          </div>
          <label className="block">
            <span className="label">Owner / contact</span>
            <input
              value={draft.ownerName}
              onChange={(event) => set("ownerName", event.target.value)}
              className="input"
              placeholder="Partner name"
            />
          </label>
          <label className="block">
            <span className="label">Prep time (min)</span>
            <input
              type="number"
              min={5}
              max={180}
              value={draft.prepTime}
              onChange={(event) => set("prepTime", event.target.value)}
              className="input"
            />
          </label>
          <label className="block">
            <span className="label">Minimum order (MAD)</span>
            <input
              type="number"
              min={0}
              value={draft.minOrder}
              onChange={(event) => set("minOrder", event.target.value)}
              className="input"
            />
          </label>
          <label className="block">
            <span className="label">Delivery fee (MAD)</span>
            <input
              type="number"
              min={0}
              value={draft.deliveryFee}
              onChange={(event) => set("deliveryFee", event.target.value)}
              className="input"
            />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-xl bg-cream px-3 py-2 sm:col-span-2">
            <span>
              <span className="block text-[11px] font-extrabold">Open for orders</span>
              <span className="block text-[11px] text-ink/40">
                Leave closed while you add the menu.
              </span>
            </span>
            <input
              type="checkbox"
              checked={draft.isOpen}
              onChange={(event) => set("isOpen", event.target.checked)}
              className="h-4 w-4 accent-teal"
            />
          </label>
        </div>

        {error ? (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="btn btn-primary btn-sm">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {store ? "Save changes" : "Create store"}
          </button>
        </div>
      </form>
    </div>
  );
}

function DriverEditModal({
  driver,
  busy,
  onClose,
  onSave,
}: {
  driver: Driver;
  busy: boolean;
  onClose: () => void;
  onSave: (patch: {
    vehicle: string;
    plate: string;
    phone: string;
    cashLimit: number;
    active: boolean;
    resetCash: boolean;
    status: Driver["status"];
  }) => Promise<void>;
}) {
  const [vehicle, setVehicle] = useState(driver.vehicle);
  const [plate, setPlate] = useState(driver.plate);
  const [phone, setPhone] = useState(driver.phone);
  const [cashLimit, setCashLimit] = useState(String(driver.cashLimit));
  const [active, setActive] = useState(driver.active);
  const [resetCash, setResetCash] = useState(false);
  const [status, setStatus] = useState<Driver["status"]>(driver.status);

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-ink/50 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label={`Manage ${driver.name}`}
        className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          void onSave({
            vehicle,
            plate,
            phone,
            cashLimit: Number(cashLimit) || 0,
            active,
            resetCash,
            status,
          });
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold">{driver.name}</h2>
            <p className="flex items-center gap-1 text-[11px] font-bold text-ink/40">
              {driver.citySlug} · {driver.deliveries} deliveries ·
              <Star size={10} className="fill-saffron text-saffron" />
              {driver.rating}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl border border-ink/10 text-ink/40 hover:text-ink"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="label">Vehicle</span>
              <input
                value={vehicle}
                onChange={(event) => setVehicle(event.target.value)}
                className="input"
              />
            </label>
            <label className="block">
              <span className="label">Plate</span>
              <input
                value={plate}
                onChange={(event) => setPlate(event.target.value)}
                className="input"
              />
            </label>
          </div>
          <label className="block">
            <span className="label">Phone</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="input"
              inputMode="tel"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="label">Cash limit (MAD)</span>
              <input
                type="number"
                min={0}
                value={cashLimit}
                onChange={(event) => setCashLimit(event.target.value)}
                className="input"
              />
            </label>
            <label className="block">
              <span className="label">Status</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as Driver["status"])}
                className="input"
              >
                <option value="offline">Offline</option>
                <option value="available">Available</option>
                <option value="busy">Busy</option>
              </select>
            </label>
          </div>
          <label className="flex items-center justify-between gap-3 rounded-xl bg-cream px-3 py-2">
            <span className="text-[11px] font-extrabold">Active courier</span>
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
              className="h-4 w-4 accent-teal"
            />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-xl bg-cream px-3 py-2">
            <span>
              <span className="block text-[11px] font-extrabold">Reset cash on hand</span>
              <span className="block text-[11px] text-ink/40">
                Currently {money(driver.cashOnHand)} collected.
              </span>
            </span>
            <input
              type="checkbox"
              checked={resetCash}
              onChange={(event) => setResetCash(event.target.checked)}
              className="h-4 w-4 accent-teal"
            />
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="btn btn-primary btn-sm">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Save driver
          </button>
        </div>
      </form>
    </div>
  );
}

function AdminOrderCard({
  order,
  drivers,
  busy,
  chosenDriver,
  onChooseDriver,
  onAssign,
  onAuto,
  onStatus,
  compact = false,
}: {
  order: OrderView;
  drivers: Driver[];
  busy: boolean;
  chosenDriver?: string;
  onChooseDriver: (driverId: string) => void;
  onAssign: () => void;
  onAuto: () => void;
  onStatus: (status: OrderStatus) => void;
  compact?: boolean;
}) {
  const meta = STATUS_META[order.status];
  const terminal = order.status === "delivered" || order.status === "cancelled";
  const canAssign = !terminal && !order.driverId && order.status === "ready";
  const transitions = availableTransitions(order, { role: "admin" }).filter(
    (rule) => rule.to !== "assigned",
  );
  const available = drivers.filter((driver) => driver.status !== "offline");

  return (
    <article className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-extrabold">{order.code}</span>
            <span className="pill">{meta.label}</span>
            {order.status === "ready" ? (
              <span className="pill pill-warm">
                <Clock3 size={10} /> waiting dispatch
              </span>
            ) : null}
          </div>
          <div className="mt-1 text-[11px] font-bold text-ink/35">
            {order.citySlug} · {timeAgo(order.createdAt)} · {order.customerName}
          </div>
        </div>
        <div className="text-end">
          <div className="text-base font-extrabold">{money(order.total)}</div>
          <div className="text-[11px] font-medium text-teal">COD</div>
        </div>
      </div>

      <div className="mt-3 flex items-start gap-2 text-[11px] leading-4 text-ink/45">
        <MapPin size={12} className="mt-0.5 shrink-0 text-teal" />
        <span>
          <span className="font-extrabold text-ink/65">{order.store?.name}</span> ·{" "}
          {order.address}, {order.landmark}
        </span>
      </div>

      {!compact ? (
        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
          {order.items.map((item) => (
            <span key={item.productId} className="rounded-lg bg-cream px-2 py-1 font-bold text-ink/55">
              {item.qty}× {item.name}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink/5 pt-3">
        {order.driver ? (
          <span className="inline-flex items-center gap-1 rounded-lg bg-teal/8 px-2 py-1 text-[11px] font-extrabold text-teal">
            <Bike size={11} /> {order.driver.name}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-lg bg-ink/5 px-2 py-1 text-[11px] font-bold text-ink/40">
            <Bike size={11} /> no driver
          </span>
        )}

        {canAssign ? (
          <>
            <select
              value={chosenDriver || ""}
              onChange={(event) => onChooseDriver(event.target.value)}
              className="h-8 rounded-lg border border-ink/10 bg-white px-2 text-[11px] font-bold"
              aria-label="Choose driver"
            >
              <option value="">Choose driver…</option>
              {available.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name} · {money(driver.cashOnHand)} cash
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onAssign}
              disabled={busy || !chosenDriver}
              className="btn btn-primary btn-sm disabled:opacity-40"
            >
              Assign
            </button>
            <button
              type="button"
              onClick={onAuto}
              disabled={busy}
              className="btn btn-ghost btn-sm"
            >
              <Wand2 size={12} /> Auto
            </button>
          </>
        ) : null}

        {!terminal && transitions.length ? (
          <select
            value=""
            onChange={(event) => {
              if (event.target.value) onStatus(event.target.value as OrderStatus);
            }}
            className="ms-auto h-8 rounded-lg border border-ink/10 bg-white px-2 text-[11px] font-bold text-ink/55"
            aria-label="Next legal status"
          >
            <option value="">Next step…</option>
            {transitions.map((rule) => (
              <option key={rule.to} value={rule.to}>
                {STATUS_META[rule.to].label}
                {rule.requiresReason ? " (reason required)" : ""}
              </option>
            ))}
          </select>
        ) : (
          <span className="ms-auto text-[11px] font-medium text-ink/30">
            closed
          </span>
        )}
      </div>
    </article>
  );
}
