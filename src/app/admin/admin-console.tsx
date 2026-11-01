"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Banknote,
  Bike,
  Building2,
  CarTaxiFront,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  MapPin,
  PackageCheck,
  Pencil,
  Pill,
  Plus,
  RefreshCw,
  RotateCcw,
  Database,
  History,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  Lock,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  ShoppingBasket as ShoppingBasketIcon,
  Star,
  Store as StoreIcon,
  Trash2,
  Truck,
  Users,
  UtensilsCrossed,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import { AccountProvisionModal, resizePhoto } from "./account-provision-modal";
import { AdminMenuModal } from "./admin-menu-modal";
import { THEME_PRESETS } from "@/lib/theme";
import { resizeImage } from "@/lib/image-client";
import { CITY_SERVICES, cityServices } from "@/lib/city-services";
import { computeAnalytics } from "@/lib/analytics";
import {
  SERVICE_COMMISSION_DEFINITIONS,
  normalizeServiceCommissions,
  serviceCommission,
} from "@/lib/commissions";
import type { AdminUserView, OrderView } from "@/lib/db";
import { storePhoto } from "@/lib/store-images";
import type {
  AuditEntry,
  City,
  CityService,
  Driver,
  OrderStatus,
  PlatformSettings,
  ServiceCommissionId,
  TaxiRide,
  Store,
  StoreCategory,
} from "@/lib/types";
import type { DataSourceStatus } from "@/lib/data-source";
import type { OperationalAlert } from "@/lib/alerts";
import { getOpenState } from "@/lib/hours";
import { availableTransitions } from "@/lib/order-machine";
import { STATUS_META } from "@/lib/types";
import { categoryLabel, money, timeAgo } from "@/lib/utils";
import { MapView, type MapPoint } from "@/components/map-view";
import { useLiveEvents } from "@/lib/use-live-events";
import { InsightsAssistant } from "@/components/insights-assistant";

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
  | "analytics"
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
  image?: string;
};

const TABS: { id: Tab; label: string; icon: typeof MapPin }[] = [
  { id: "overview", label: "Live", icon: Zap },
  { id: "analytics", label: "Analytics", icon: CircleDollarSign },
  { id: "orders", label: "Orders", icon: PackageCheck },
  { id: "stores", label: "Stores", icon: StoreIcon },
  { id: "drivers", label: "Fleet", icon: Bike },
  { id: "cities", label: "Cities", icon: Building2 },
  { id: "activity", label: "Activity", icon: History },
  { id: "data", label: "Data sources", icon: Database },
  { id: "settings", label: "Settings", icon: Settings2 },
];

const SERVICE_COMMISSION_ICONS = {
  food: UtensilsCrossed,
  grocery: ShoppingBasketIcon,
  pharmacy: Pill,
  taxi: CarTaxiFront,
} satisfies Record<ServiceCommissionId, typeof UtensilsCrossed>;

export function AdminConsole({
  initialOrders,
  initialTaxiRides,
  initialStores,
  initialDrivers,
  initialUsers,
  initialCities,
  initialSettings,
  initialStats,
  initialAuditLogs,
  initialDataSource,
  initialAlerts,
}: {
  initialOrders: OrderView[];
  initialTaxiRides: TaxiRide[];
  initialStores: Store[];
  initialDrivers: Driver[];
  initialUsers: AdminUserView[];
  initialCities: City[];
  initialSettings: PlatformSettings;
  initialStats: Stats;
  initialAuditLogs: AuditEntry[];
  initialDataSource: DataSourceStatus;
  initialAlerts: OperationalAlert[];
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [taxiRides, setTaxiRides] = useState(initialTaxiRides);
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
  const [storeView, setStoreView] = useState<"restaurant" | "grocery" | "other">("restaurant");
  const [cityServicesFor, setCityServicesFor] = useState<City | null>(null);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [provision, setProvision] = useState<{
    role: "driver" | "merchant";
    storeId?: string;
    kind?: "delivery" | "taxi" | "both";
  } | null>(null);
  const [menuStore, setMenuStore] = useState<Store | null>(null);
  const router = useRouter();

  const pendingUsers = useMemo(
    () => users.filter((user) => (user.accountStatus ?? "active") === "pending"),
    [users],
  );
  const deliveryDrivers = useMemo(
    () => drivers.filter((driver) => driver.kind !== "taxi"),
    [drivers],
  );
  const taxiDrivers = useMemo(
    () => drivers.filter((driver) => driver.kind === "taxi" || driver.kind === "both"),
    [drivers],
  );
  const visibleStores = useMemo(() => {
    if (storeView === "grocery") {
      return stores.filter((store) => store.category === "grocery");
    }
    if (storeView === "restaurant") {
      return stores.filter(
        (store) => store.category === "restaurant" || store.category === "cafe",
      );
    }
    return stores.filter(
      (store) => store.category !== "restaurant" && store.category !== "cafe" && store.category !== "grocery",
    );
  }, [storeView, stores]);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const response = await fetch("/api/admin/state", { cache: "no-store" });
      if (response.ok) {
        const data = (await response.json()) as {
          orders: OrderView[];
          taxiRides?: TaxiRide[];
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

  async function saveCityServices(
    city: City,
    services: Partial<Record<CityService, boolean>>,
  ) {
    setBusy(city.id);
    try {
      const response = await fetch("/api/admin/cities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cityId: city.id, services }),
      });
      const data = (await response.json()) as { city?: City; error?: string };
      if (!response.ok || !data.city) {
        setToast(data.error || "Could not update city services");
        return;
      }
      setCities((current) =>
        current.map((item) => (item.id === city.id ? data.city! : item)),
      );
      setCityServicesFor(null);
      setToast(`${city.name} services updated`);
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
      kind: Driver["kind"];
      photo?: string;
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

  async function deleteStore(store: Store) {
    if (
      !window.confirm(
        `Delete ${store.name} and all of its menu items? This cannot be undone.`,
      )
    ) {
      return;
    }
    setBusy(store.id);
    try {
      const response = await fetch("/api/admin/stores", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: store.id }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setToast(data.error || "Could not delete the store");
        return;
      }
      setStores((current) => current.filter((item) => item.id !== store.id));
      setToast(`${store.name} deleted`);
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
      router.refresh();
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

  const analytics = useMemo(
    () => computeAnalytics(orders, taxiRides, stores, users, settings.commissions),
    [orders, taxiRides, stores, users, settings.commissions],
  );

  const commissions = useMemo(
    () => normalizeServiceCommissions(settings.commissions),
    [settings.commissions],
  );

  function updateCommission(
    id: ServiceCommissionId,
    patch: Partial<{ fixedFee: number; rate: number }>,
  ) {
    const next = normalizeServiceCommissions(settings.commissions);
    next[id] = { ...next[id], ...patch };
    setSettings({ ...settings, commissions: next });
  }

  const statsCards = [
    { label: "Live orders", value: `${stats.liveOrders}` },
    { label: "Delivered GMV", value: money(stats.gmv) },
    { label: "Wassl profit", value: money(analytics.profit.total) },
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
              <span className="status-dot live-dot text-brand" /> Live across {stats.liveCities} cities
            </span>
            <span className="inline-flex items-center gap-1">
              <Users size={12} className="text-brand" /> {stats.stores} stores
            </span>
            <span className="inline-flex items-center gap-1">
              <Truck size={12} className="text-brand" /> {activeOrders.length} orders in flight
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
              <span className="ms-1 grid h-5 min-w-5 place-items-center rounded-full bg-coral px-1 text-[11px] font-semibold text-on-dark">
                {pendingUsers.length}
              </span>
            ) : null}
          </Link>
          <button type="button" onClick={() => refresh()} className="btn btn-ghost">
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {pendingUsers.length ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-saffron/30 bg-saffron/10 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-[6px] bg-saffron/25 text-saffron-deep">
              <Users size={16} />
            </span>
            <div>
              <div className="text-[13px] font-semibold">
                {pendingUsers.length} account{pendingUsers.length === 1 ? "" : "s"} waiting
                for approval
              </div>
              <div className="text-[11px] font-bold text-muted">
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

      <div className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-line pt-4 lg:grid-cols-5">
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
          className="fixed inset-0 z-[70] grid place-items-center bg-surface-20 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => setCancelTarget(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Cancel order"
            className="w-full max-w-md rounded-[10px] bg-surface p-5 shadow-[var(--shadow-float)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-[6px] bg-danger-soft text-danger">
                <AlertTriangle size={17} />
              </span>
              <div>
                <h2 className="text-base font-semibold">Cancel {cancelTarget.code}?</h2>
                <p className="text-[11px] font-bold text-muted">
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
                className="btn btn-sm bg-danger text-[#fffaf1] disabled:opacity-40"
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
          defaultCategory={storeView === "grocery" ? "grocery" : undefined}
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

      {provision ? (
        <AccountProvisionModal
          cities={cities}
          stores={stores}
          defaultRole={provision.role}
          defaultKind={provision.kind}
          defaultStoreId={provision.storeId}
          onClose={() => setProvision(null)}
          onCreated={async () => {
            await refresh(true);
          }}
        />
      ) : null}

      {menuStore ? (
        <AdminMenuModal store={menuStore} onClose={() => setMenuStore(null)} />
      ) : null}

      {editingDriver ? (
        <DriverEditModal
          driver={editingDriver}
          busy={busy === editingDriver.id}
          onClose={() => setEditingDriver(null)}
          onSave={(patch) => saveDriver(editingDriver, patch)}
        />
      ) : null}

      {cityServicesFor ? (
        <CityServicesModal
          city={cityServicesFor}
          busy={busy === cityServicesFor.id}
          onClose={() => setCityServicesFor(null)}
          onSave={(services) => saveCityServices(cityServicesFor, services)}
        />
      ) : null}

      {tab === "overview" ? (
        <>
        <div className="mt-4">
          <InsightsAssistant role="admin" />
        </div>
        {initialAlerts.length ? (
          <section className="mt-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[13px] font-semibold">Operational alerts</h2>
              <span className="pill">{initialAlerts.length}</span>
            </div>
            <div className="mt-2 grid gap-2 lg:grid-cols-2">
              {initialAlerts.map((alert) => (
                <Link
                  key={alert.id}
                  href={alert.href || "/admin"}
                  className={`rounded-[8px] border p-3 transition-colors hover:border-line-strong ${
                    alert.severity === "critical"
                      ? "border-danger/30 bg-danger-soft/60"
                      : alert.severity === "warning"
                        ? "border-saffron/30 bg-saffron/10"
                        : "border-line bg-surface"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                        alert.severity === "critical"
                          ? "bg-danger"
                          : alert.severity === "warning"
                            ? "bg-saffron"
                            : "bg-brand"
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold">{alert.title}</div>
                      <div className="mt-0.5 text-[10px] leading-4 text-muted">{alert.detail}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
        <section className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div className="card overflow-hidden">
            <MapView points={mapPoints} zoom={12} height={420} />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-paper px-4 py-3">
              <div className="flex items-center gap-2 text-[11px] font-bold text-muted">
                <span className="status-dot live-dot text-brand" />
                {mapPoints.length} live markers · updated in real time
              </div>
              <div className="flex flex-wrap gap-3 text-[11px] font-medium text-muted">
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
                <CheckCircle2 size={28} className="text-brand" />
                <h3 className="mt-3 text-lg font-semibold">All clear</h3>
                <p className="mt-1 text-sm text-muted">No live orders right now.</p>
              </div>
            ) : null}
          </div>
        </section>
        </>
      ) : null}

      {tab === "analytics" ? (
        <section className="mt-4 space-y-4" id="analytics">
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.04em]">Profit & growth</h2>
            <p className="mt-1 text-[11px] text-muted">
              Wassl keeps the per-service commission below. Fixed fees apply per
              completed job; percentages apply to goods or fare. Store commission
              stays separate.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              {
                label: "Total profit",
                value: money(analytics.profit.total),
                note: `${analytics.deliveredOrders + analytics.completedRides} fulfilled ${
                  analytics.deliveredOrders + analytics.completedRides === 1 ? "job" : "jobs"
                }`,
                icon: CircleDollarSign,
              },
              {
                label: "Food margin",
                value: money(analytics.profit.food),
                note: `${analytics.services.food.jobs} ${
                  analytics.services.food.jobs === 1 ? "order" : "orders"
                } · ${commissions.food.fixedFee} MAD + ${commissions.food.rate}%`,
                icon: Truck,
              },
              {
                label: "Grocery margin",
                value: money(analytics.profit.grocery),
                note: `${money(analytics.profit.grocerySales)} goods · ${commissions.grocery.rate}%`,
                icon: ShoppingBasketIcon,
              },
              {
                label: "Pharmacy margin",
                value: money(analytics.profit.pharmacy),
                note: `${money(analytics.profit.pharmacySales)} goods · ${commissions.pharmacy.rate}%`,
                icon: Pill,
              },
              {
                label: "Taxi margin",
                value: money(analytics.profit.taxi),
                note: `${analytics.completedRides} ${
                  analytics.completedRides === 1 ? "trip" : "trips"
                } · ${commissions.taxi.fixedFee} MAD + ${commissions.taxi.rate}%`,
                icon: CarTaxiFront,
              },
            ].map((item) => (
              <div key={item.label} className="card p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-muted">{item.label}</span>
                  <item.icon size={15} className="text-brand" />
                </div>
                <div className="mt-2 font-display text-[26px] font-semibold tracking-[-0.03em] tnum">
                  {item.value}
                </div>
                <div className="mt-1 text-[10px] leading-4 text-muted">{item.note}</div>
              </div>
            ))}
          </div>

          <div className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-[15px] font-semibold">Commission detail</h3>
                <p className="mt-0.5 text-[10px] text-muted">
                  Live rates and earnings from delivered orders and completed rides.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTab("settings")}
                className="pill hover:text-brand"
              >
                Set in Settings
              </button>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-line text-start text-[9px] uppercase tracking-[0.06em] text-muted">
                    <th className="pb-2 text-start font-medium">Service</th>
                    <th className="hidden pb-2 text-start font-medium sm:table-cell">Basis</th>
                    <th className="pb-2 text-end font-medium">Jobs</th>
                    <th className="pb-2 text-end font-medium">Base</th>
                    <th className="pb-2 text-end font-medium">Fixed</th>
                    <th className="pb-2 text-end font-medium">Rate</th>
                    <th className="pb-2 text-end font-medium">Earned</th>
                  </tr>
                </thead>
                <tbody>
                  {SERVICE_COMMISSION_DEFINITIONS.map((definition) => {
                    const row = analytics.services[definition.id];
                    return (
                      <tr
                        key={definition.id}
                        className="border-b border-line/60 last:border-0"
                      >
                        <td className="py-2.5 pe-2 font-semibold">
                          {definition.label}
                          <span className="mt-0.5 block text-[9px] font-normal text-muted sm:hidden">
                            {definition.basis}
                          </span>
                        </td>
                        <td className="hidden py-2.5 text-muted sm:table-cell">
                          {definition.basis}
                        </td>
                        <td className="py-2.5 text-end tnum">{row.jobs}</td>
                        <td className="py-2.5 text-end tnum">{money(row.base)}</td>
                        <td className="py-2.5 text-end tnum">{money(row.fixed)}</td>
                        <td className="py-2.5 text-end tnum">{commissions[definition.id].rate}%</td>
                        <td className="py-2.5 text-end font-semibold text-brand tnum">
                          {money(row.earned)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.45fr_0.55fr]">
            <div className="card p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[15px] font-semibold">Profit, last 14 days</h3>
                  <p className="mt-0.5 text-[10px] text-muted">
                    Delivered orders, completed rides and grocery margin.
                  </p>
                </div>
                <span className="pill">{money(analytics.gmv)} GMV</span>
              </div>
              <div className="mt-6 flex h-44 items-end gap-1 border-b border-line pb-1">
                {analytics.days.map((day, index) => {
                  const max = Math.max(...analytics.days.map((item) => item.profit), 1);
                  const height = day.profit ? Math.max(6, Math.round((day.profit / max) * 120)) : 2;
                  return (
                    <div key={day.key} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                      <div
                        className={`w-full rounded-t-[3px] transition-colors ${
                          day.profit ? "bg-brand/80 group-hover:bg-brand" : "bg-surface-2"
                        }`}
                        style={{ height: `${height}px` }}
                        title={`${day.label}: ${money(day.profit)}`}
                      />
                      {index % 2 === 0 ? (
                        <span className="truncate text-[8px] text-muted">{day.label}</span>
                      ) : (
                        <span className="text-[8px] text-transparent">·</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px] text-muted">
                <span>{analytics.days[0]?.label}</span>
                <span>{analytics.days[analytics.days.length - 1]?.label}</span>
              </div>
            </div>

            <div className="card p-5">
              <h3 className="text-[15px] font-semibold">Volume</h3>
              <dl className="mt-4 space-y-3 text-[12px]">
                {[
                  { label: "Delivered orders", value: String(analytics.deliveredOrders) },
                  { label: "Completed rides", value: String(analytics.completedRides) },
                  { label: "Grocery orders", value: String(analytics.groceryOrders) },
                  { label: "Average order", value: money(analytics.averageOrder) },
                  { label: "Signed-in customers", value: String(analytics.signups.customers) },
                  { label: "Partner accounts", value: String(analytics.signups.merchants + analytics.signups.drivers) },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-2">
                    <dt className="text-muted">{row.label}</dt>
                    <dd className="font-semibold tnum">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card p-5">
              <h3 className="text-[15px] font-semibold">Top stores by GMV</h3>
              <div className="mt-3 divide-y divide-line border-t border-line">
                {analytics.topStores.length ? (
                  analytics.topStores.map((store, index) => (
                    <div key={store.id} className="flex items-center gap-3 py-2.5">
                      <span className="w-5 text-[11px] font-semibold text-muted tnum">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] font-semibold">{store.name}</div>
                        <div className="text-[10px] text-muted">{store.citySlug}</div>
                      </div>
                      <div className="text-end">
                        <div className="text-[12px] font-semibold tnum">{money(store.gmv)}</div>
                        <div className="text-[10px] text-muted">{store.orders} orders</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-6 text-center text-[12px] text-muted">No delivered orders yet.</p>
                )}
              </div>
            </div>

            <div className="card p-5">
              <h3 className="text-[15px] font-semibold">Recent margin</h3>
              <div className="mt-3 divide-y divide-line border-t border-line">
                {analytics.recent.length ? (
                  analytics.recent.map((event) => (
                    <div key={event.id} className="flex items-center gap-3 py-2.5">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[4px] bg-brand-soft text-brand">
                        {event.kind === "taxi" ? (
                          <CarTaxiFront size={13} />
                        ) : event.kind === "grocery" ? (
                          <ShoppingBasketIcon size={13} />
                        ) : (
                          <Truck size={13} />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] font-semibold">{event.label}</div>
                        <div className="truncate text-[10px] text-muted">{event.note}</div>
                      </div>
                      <span className="text-[12px] font-semibold text-brand tnum">
                        +{money(event.profit)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="py-6 text-center text-[12px] text-muted">No margin recorded yet.</p>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {tab === "orders" ? (
        <section className="mt-4" id="orders">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-[-0.04em]">All orders</h2>
            <span className="text-[11px] font-bold text-muted">{orders.length} total</span>
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
              <h2 className="text-xl font-semibold tracking-[-0.04em]">Stores & supply</h2>
              <p className="mt-1 text-[11px] text-muted">
                Restaurants and grocery stores are managed separately. Add,
                edit, pause or remove a partner; merchants keep their dashboard.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="pill">{visibleStores.length} shown</span>
              <div className="flex rounded-[6px] border border-line p-0.5">
                {[
                  { id: "restaurant" as const, label: "Restaurants" },
                  { id: "grocery" as const, label: "Grocery" },
                  { id: "other" as const, label: "Other" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setStoreView(item.id)}
                    className={`rounded-[4px] px-2.5 py-1.5 text-[11px] font-semibold ${
                      storeView === item.id
                        ? "bg-ink text-on-dark"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingStore(null);
                  setStoreFormOpen(true);
                }}
                className="btn btn-primary btn-sm"
              >
                <Plus size={13} />{" "}
                {storeView === "grocery" ? "Add grocery" : "Add store"}
              </button>
              <button
                type="button"
                onClick={() => setProvision({ role: "merchant" })}
                className="btn btn-ghost btn-sm"
              >
                <KeyRound size={13} /> Store login
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
                  {visibleStores.map((store) => {
                    const openState = getOpenState(store);
                    return (
                      <tr key={store.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-[6px] bg-surface-2">
                            <Image
                              src={storePhoto(store)}
                              alt=""
                              fill
                              sizes="32px"
                              className="object-cover"
                            />
                          </span>
                          <div>
                            <div className="font-semibold">{store.name}</div>
                            <div className="text-[11px] text-muted">{store.landmark}</div>
                          </div>
                        </div>
                      </td>
                      <td className="text-muted">{store.citySlug}</td>
                      <td className="text-muted">{categoryLabel(store.category)}</td>
                      <td className="font-semibold">{store.rating}</td>
                      <td className="font-semibold">{money(store.deliveryFee)}</td>
                      <td>
                        <span
                          className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase ${
                            openState.open ? "bg-brand-soft text-brand" : "bg-danger-soft text-danger"
                          }`}
                        >
                          {openState.open ? "Open" : "Closed"}
                        </span>
                        <div className="mt-1 text-[11px] font-bold text-muted">
                          {openState.detail}
                        </div>
                      </td>
                      <td className="text-end">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setMenuStore(store)}
                            className="btn btn-ghost btn-sm"
                          >
                            <Plus size={11} /> Menu
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setProvision({ role: "merchant", storeId: store.id });
                            }}
                            className="btn btn-ghost btn-sm"
                          >
                            <KeyRound size={11} /> Login
                          </button>
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
                          <button
                            type="button"
                            onClick={() => void deleteStore(store)}
                            disabled={busy === store.id}
                            className="btn btn-ghost btn-sm text-danger"
                            title="Delete store and menu"
                          >
                            <Trash2 size={11} />
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
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.04em]">Fleet & credentials</h2>
              <p className="mt-1 text-[11px] text-muted">
                Delivery couriers and taxi drivers are separate teams. Each panel
                provisions a login and shows the credentials once.
              </p>
            </div>
            <span className="pill">{deliveryDrivers.length + taxiDrivers.length} profiles</span>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <DriverPanel
              title="Delivery boys"
              subtitle="Store-to-door couriers, COD and handover codes."
              icon="delivery"
              drivers={deliveryDrivers}
              busy={busy}
              onAdd={() => setProvision({ role: "driver", kind: "delivery" })}
              onManage={(driver) => setEditingDriver(driver)}
            />
            <DriverPanel
              title="Taxi drivers"
              subtitle="Ride-hailing fleet, vehicles, plates and photos."
              icon="taxi"
              drivers={taxiDrivers}
              busy={busy}
              onAdd={() => setProvision({ role: "driver", kind: "taxi" })}
              onManage={(driver) => setEditingDriver(driver)}
            />
          </div>
        </section>
      ) : null}

      {tab === "cities" ? (
        <section className="mt-4" id="cities">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.04em]">City activation</h2>
              <p className="mt-1 text-[11px] text-muted">
                Every Moroccan city is listed. Switch a city live when supply is ready.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search
                  size={14}
                  className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted"
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
                  className={`rounded-[6px] border px-3 py-1.5 text-[11px] font-semibold transition ${
                    cityFilter === item.value
                      ? "border-ink bg-ink text-on-dark"
                      : "border-line bg-surface text-muted"
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
                        <div className="font-semibold">{city.name}</div>
                        <div className="arabic text-[11px] text-muted">{city.nameAr}</div>
                      </td>
                      <td className="text-muted">{city.region}</td>
                      <td className="text-muted">
                        {city.population ? city.population.toLocaleString("en-US") : "—"}
                      </td>
                      <td>
                        {city.priority ? (
                          <span className="pill pill-warm">Priority</span>
                        ) : (
                          <span className="text-[11px] text-muted">—</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase ${
                            city.launchStatus === "live"
                              ? "bg-brand-soft text-brand"
                              : "bg-surface-2 text-muted"
                          }`}
                        >
                          {city.launchStatus}
                        </span>
                      </td>
                      <td className="text-end">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setCityServicesFor(city)}
                            className="btn btn-ghost btn-sm"
                          >
                            Services
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleCity(city)}
                            disabled={busy === city.id}
                            className="btn btn-ghost btn-sm"
                          >
                            {city.launchStatus === "live" ? "Set soon" : "Go live"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!cityList.length ? (
              <div className="px-4 py-10 text-center text-sm text-muted">No cities match.</div>
            ) : null}
          </div>
        </section>
      ) : null}

      {tab === "activity" ? (
        <section className="mt-4" id="activity">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.04em]">Activity trail</h2>
              <p className="mt-1 text-[11px] text-muted">
                Every status change, assignment and configuration edit is attributed to
                the signed-in actor and kept for the last {auditLogs.length} events.
              </p>
            </div>
            <select
              value={activityEntity}
              onChange={(event) => setActivityEntity(event.target.value)}
              className="h-9 rounded-[6px] border border-line bg-surface px-3 text-[11px] font-bold"
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
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[6px] bg-surface-2 text-brand">
                      <EntityIcon entity={entry.entity} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-semibold">{entry.summary}</span>
                        {entry.before || entry.after ? (
                          <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-bold text-muted">
                            {entry.before} → {entry.after}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold text-muted">
                        <span className="rounded-full bg-brand-soft px-2 py-0.5 uppercase tracking-wide text-brand">
                          {entry.actorRole}
                        </span>
                        <span>{entry.actorName || entry.actorId || "system"}</span>
                        <span>·</span>
                        <span>{entry.action}</span>
                        <span>·</span>
                        <span>{timeAgo(entry.at)}</span>
                      </div>
                      {entry.note ? (
                        <p className="mt-1 text-[11px] italic text-muted">“{entry.note}”</p>
                      ) : null}
                    </div>
                  </div>
                ))}
              {!auditLogs.filter((entry) =>
                activityEntity === "all" ? true : entry.entity === activityEntity,
              ).length ? (
                <div className="px-4 py-12 text-center text-sm text-muted">
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
                <h2 className="text-xl font-semibold tracking-[-0.04em]">Restaurant data</h2>
                <p className="mt-1 text-[11px] leading-5 text-muted">
                  The directory is a sealed snapshot. Menus and prices are authored demo
                  content and cannot be edited at runtime.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-[11px] font-medium text-muted">
                <Lock size={10} /> {dataSource.locked ? "Locked" : "Live"}
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[10px] bg-surface-2/70 p-3">
                <div className="text-[11px] font-medium text-muted">
                  Restaurants
                </div>
                <div className="mt-1 text-2xl font-semibold">{dataSource.restaurantCount}</div>
              </div>
              <div className="rounded-[10px] bg-surface-2/70 p-3">
                <div className="text-[11px] font-medium text-muted">
                  Menu items
                </div>
                <div className="mt-1 text-2xl font-semibold">{dataSource.menuItemCount}</div>
              </div>
              <div className="rounded-[10px] bg-surface-2/70 p-3">
                <div className="text-[11px] font-medium text-muted">
                  Cities
                </div>
                <div className="mt-1 text-2xl font-semibold">
                  {Object.keys(dataSource.cityCounts).length}
                </div>
              </div>
            </div>

            <div
              className={`mt-4 rounded-[10px] border p-4 ${
                dataSource.integrity.ok
                  ? "border-teal/20 bg-brand-soft"
                  : "border-eed-200 bg-danger-soft"
              }`}
            >
              <div className="flex items-center gap-2 text-[11px] font-semibold">
                <ShieldCheck
                  size={14}
                  className={dataSource.integrity.ok ? "text-brand" : "text-danger"}
                />
                {dataSource.integrity.ok
                  ? "Snapshot checksum verified"
                  : "Snapshot checksum mismatch"}
              </div>
              <div className="mt-1 break-all font-mono text-[11px] text-muted">
                sha256:{dataSource.integrity.actual}
              </div>
              <div className="mt-1 text-[11px] text-muted">
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

            <p className="mt-4 rounded-[6px] bg-saffron/10 p-3 text-[11px] leading-5 text-muted">
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
              <h3 className="text-sm font-semibold">Sources & licences</h3>
              <div className="mt-3 space-y-3">
                {dataSource.sources.map((source) => (
                  <div key={source.id} className="rounded-[6px] border border-line p-3">
                    <div className="flex items-center justify-between gap-2">
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-[11px] font-semibold text-brand hover:underline"
                      >
                        {source.name} ↗
                      </a>
                      <span className="text-[11px] font-bold uppercase tracking-wide text-muted">
                        {source.id}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] font-bold text-muted">{source.role}</div>
                    <div className="mt-0.5 text-[11px] text-muted">{source.license}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <h3 className="text-sm font-semibold">Coverage by city</h3>
              <div className="mt-3 space-y-1.5">
                {Object.entries(dataSource.cityCounts).map(([city, count]) => (
                  <div
                    key={city}
                    className="flex items-center justify-between text-[11px] font-bold"
                  >
                    <span className="capitalize text-muted">{city}</span>
                    <span className="rounded-[6px] bg-surface-2 px-2 py-0.5 text-muted">
                      {count} restaurants
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-4 text-muted">
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
              <h2 className="text-xl font-semibold tracking-[-0.04em]">Platform settings</h2>
              <Settings2 size={18} className="text-brand" />
            </div>
            <p className="mt-1 text-[11px] text-muted">
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
                <span className="label">Arabic brand name</span>
                <input
                  value={settings.brandNameAr}
                  onChange={(event) =>
                    setSettings({ ...settings, brandNameAr: event.target.value })
                  }
                  className="input arabic"
                />
              </label>

              <div>
                <span className="label">Theme preset</span>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {THEME_PRESETS.map((preset) => {
                    const active = (settings.themePreset ?? "coastal") === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() =>
                          setSettings({
                            ...settings,
                            themePreset: preset.id,
                            primaryColor: preset.primary,
                            accentColor: preset.accent,
                          })
                        }
                        className={`flex items-center gap-2 rounded-[8px] border p-2 text-start transition-colors ${
                          active
                            ? "border-brand bg-brand-soft/50 ring-1 ring-brand/20"
                            : "border-line bg-surface hover:border-line-strong"
                        }`}
                      >
                        <span className="flex shrink-0 -space-x-1">
                          <span
                            className="h-6 w-6 rounded-full border-2 border-surface"
                            style={{ background: preset.primary }}
                          />
                          <span
                            className="h-6 w-6 rounded-full border-2 border-surface"
                            style={{ background: preset.accent }}
                          />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[11px] font-semibold">
                            {preset.label}
                          </span>
                          <span className="block truncate text-[10px] text-muted">
                            {preset.note}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="label">Primary colour</span>
                  <div className="flex items-center gap-2 rounded-[6px] border border-line bg-surface p-1.5">
                    <input
                      type="color"
                      value={settings.primaryColor}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          primaryColor: event.target.value,
                          themePreset: "custom",
                        })
                      }
                      className="h-8 w-10 cursor-pointer rounded-[4px] border-0 bg-transparent p-0"
                      aria-label="Primary colour"
                    />
                    <span className="text-[11px] font-medium uppercase text-muted">
                      {settings.primaryColor}
                    </span>
                  </div>
                </label>
                <label className="block">
                  <span className="label">Accent colour</span>
                  <div className="flex items-center gap-2 rounded-[6px] border border-line bg-surface p-1.5">
                    <input
                      type="color"
                      value={settings.accentColor ?? "#8c3a00"}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          accentColor: event.target.value,
                          themePreset: "custom",
                        })
                      }
                      className="h-8 w-10 cursor-pointer rounded-[4px] border-0 bg-transparent p-0"
                      aria-label="Accent colour"
                    />
                    <span className="text-[11px] font-medium uppercase text-muted">
                      {settings.accentColor ?? "#8c3a00"}
                    </span>
                  </div>
                </label>
              </div>

              <label className="block">
                <span className="label">Default theme</span>
                <select
                  value={settings.defaultTheme ?? "system"}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      defaultTheme: event.target.value as PlatformSettings["defaultTheme"],
                    })
                  }
                  className="input"
                >
                  <option value="system">Follow the visitor’s device</option>
                  <option value="light">Light by default</option>
                  <option value="dark">Dark by default</option>
                </select>
                <span className="mt-1 block text-[10px] leading-4 text-muted">
                  A visitor’s own light/dark toggle always wins.
                </span>
              </label>

              <div className="rounded-[8px] border border-line p-3">
                <div className="flex flex-wrap items-center gap-3">
                  {settings.logoImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={settings.logoImage}
                      alt="Current logo"
                      className="h-12 w-12 rounded-[6px] bg-surface-2 object-contain p-1"
                    />
                  ) : (
                    <span className="grid h-12 w-12 place-items-center rounded-[6px] bg-brand text-on-dark font-display text-lg font-semibold">
                      {settings.brandName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-semibold">Logo mark</div>
                    <div className="text-[10px] text-muted">
                      Square PNG/JPG/WebP. Used in the header, footer and auth.
                    </div>
                  </div>
                  <label className="btn btn-ghost btn-sm cursor-pointer">
                    {busy === "logo" ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : null}
                    Upload
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        setBusy("logo");
                        try {
                          const image = await resizePhoto(file, "png");
                          setSettings((current) => ({ ...current, logoImage: image }));
                        } finally {
                          setBusy("");
                        }
                      }}
                    />
                  </label>
                  {settings.logoImage ? (
                    <button
                      type="button"
                      onClick={() =>
                        setSettings((current) => ({ ...current, logoImage: undefined }))
                      }
                      className="btn btn-ghost btn-sm text-danger"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>

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
                  <span className="label">Store commission %</span>
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
                  <span className="mt-1 block text-[10px] leading-4 text-muted">
                    Merchant payout commission. Service fees below are separate.
                  </span>
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
              <div className="rounded-[8px] border border-line p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[12px] font-semibold">Service commissions</div>
                    <div className="mt-0.5 text-[10px] leading-4 text-muted">
                      Set what Wassl keeps per completed job. The percentage applies to
                      goods or fare; the fixed part is charged per order or ride.
                    </div>
                  </div>
                  <span className="pill shrink-0">
                    {money(
                      SERVICE_COMMISSION_DEFINITIONS.reduce(
                        (sum, definition) =>
                          sum +
                          serviceCommission(commissions, definition.id, definition.exampleBase),
                        0,
                      ),
                    )}{" "}
                    example
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {SERVICE_COMMISSION_DEFINITIONS.map((definition) => {
                    const Icon = SERVICE_COMMISSION_ICONS[definition.id];
                    const rule = commissions[definition.id];
                    return (
                      <div
                        key={definition.id}
                        data-commission={definition.id}
                        className="rounded-[6px] bg-surface-2/70 p-2.5"
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[5px] bg-brand-soft text-brand">
                            <Icon size={13} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <span className="text-[11px] font-semibold">
                                {definition.label}
                              </span>
                              <span className="text-[9px] uppercase tracking-[0.05em] text-muted">
                                {definition.basis}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[10px] leading-4 text-muted">
                              {definition.description}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <label className="block">
                            <span className="label !text-[10px]">Fixed (MAD)</span>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={1}
                              value={rule.fixedFee}
                              onChange={(event) =>
                                updateCommission(definition.id, {
                                  fixedFee: Number(event.target.value),
                                })
                              }
                              className="input h-9"
                            />
                          </label>
                          <label className="block">
                            <span className="label !text-[10px]">Rate (%)</span>
                            <input
                              type="number"
                              min={0}
                              max={40}
                              step={0.5}
                              value={rule.rate}
                              onChange={(event) =>
                                updateCommission(definition.id, {
                                  rate: Number(event.target.value),
                                })
                              }
                              className="input h-9"
                            />
                          </label>
                        </div>
                        <div className="mt-1 text-[10px] font-medium text-muted">
                          On {definition.exampleBase} MAD:{" "}
                          <span className="text-brand">
                            {money(
                              serviceCommission(
                                commissions,
                                definition.id,
                                definition.exampleBase,
                              ),
                            )}
                          </span>{" "}
                          to Wassl
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center justify-between rounded-[6px] bg-surface-2 p-3">
                <div>
                  <div className="text-[11px] font-semibold">City waitlist</div>
                  <div className="text-[11px] text-muted">
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
                    settings.cityWaitlistEnabled ? "bg-brand" : "bg-ink/20"
                  }`}
                  aria-label="Toggle waitlist"
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-surface shadow transition ${
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
                <h2 className="text-lg font-semibold tracking-[-0.04em]">COD reconciliation</h2>
                <Banknote size={18} className="text-brand" />
              </div>
              <div className="mt-4 space-y-2 text-[13px]">
                <div className="flex justify-between text-muted">
                  <span>Cash held by drivers</span>
                  <span className="font-semibold text-ink">
                    {money(drivers.reduce((sum, driver) => sum + driver.cashOnHand, 0))}
                  </span>
                </div>
                <div className="flex justify-between text-muted">
                  <span>Delivered GMV</span>
                  <span className="font-semibold text-ink">{money(stats.gmv)}</span>
                </div>
                <div className="flex justify-between text-muted">
                  <span>Store commission ({settings.commissionRate}%)</span>
                  <span className="font-semibold text-brand">
                    {money(Math.round((stats.gmv * settings.commissionRate) / 100))}
                  </span>
                </div>
                <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
                  <span>Store payouts due</span>
                  <span>
                    {money(
                      stats.gmv - Math.round((stats.gmv * settings.commissionRate) / 100),
                    )}
                  </span>
                </div>
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-[6px] bg-saffron/15 p-3 text-[11px] leading-5 font-bold text-muted">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                Weekly settlement run. A driver at their cash limit is blocked from new COD
                orders until they hand over cash.
              </div>
            </div>

            <div className="card p-5">
              <h2 className="text-sm font-semibold">Danger zone</h2>
              <p className="mt-1 text-[11px] leading-5 text-muted">
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
  defaultCategory,
  busy,
  onClose,
  onSave,
}: {
  store: Store | null;
  cities: City[];
  defaultCategory?: StoreCategory;
  busy: boolean;
  onClose: () => void;
  onSave: (draft: StoreDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<StoreDraft>(() => ({
    name: store?.name ?? "",
    nameAr: store?.nameAr ?? "",
    citySlug: store?.citySlug ?? cities.find((city) => city.priority)?.slug ?? cities[0]?.slug ?? "dakhla",
    category: store?.category ?? defaultCategory ?? "restaurant",
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
    image: store?.image,
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
      className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-surface-20 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label={store ? "Edit store" : "Add store"}
        className="my-6 w-full max-w-2xl rounded-[10px] bg-surface p-5 shadow-[var(--shadow-float)]"
        onClick={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.04em]">
              {store ? "Edit store" : "Add a partner store"}
            </h2>
            <p className="mt-1 text-[11px] text-muted">
              The store is created closed so you can finish the setup before it goes live.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-[6px] border border-line text-muted hover:text-ink"
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
          <div className="flex items-center gap-3 rounded-[8px] border border-line p-3 sm:col-span-2">
            {draft.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={draft.image} alt="Store cover preview" className="h-16 w-24 rounded-[6px] object-cover" />
            ) : (
              <span className="grid h-16 w-24 place-items-center rounded-[6px] bg-surface-2 text-muted">
                <ImageIcon size={20} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold">Store cover</div>
              <div className="text-[11px] text-muted">Shown on the storefront and search cards.</div>
            </div>
            <label className="btn btn-ghost btn-sm cursor-pointer">
              Upload
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const image = await resizeImage(file, {
                    width: 1200,
                    height: 800,
                    fit: "cover",
                  });
                  set("image", image);
                }}
              />
            </label>
            {draft.image ? (
              <button type="button" onClick={() => set("image", undefined)} className="btn btn-ghost btn-sm text-danger">
                Remove
              </button>
            ) : null}
          </div>
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
          <label className="flex items-center justify-between gap-3 rounded-[6px] bg-surface-2 px-3 py-2 sm:col-span-2">
            <span>
              <span className="block text-[11px] font-semibold">Open for orders</span>
              <span className="block text-[11px] text-muted">
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
          <p className="mt-3 rounded-[6px] bg-danger-soft px-3 py-2 text-[11px] font-bold text-danger">
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
    kind: Driver["kind"];
    photo?: string;
  }) => Promise<void>;
}) {
  const [vehicle, setVehicle] = useState(driver.vehicle);
  const [plate, setPlate] = useState(driver.plate);
  const [phone, setPhone] = useState(driver.phone);
  const [kind, setKind] = useState<Driver["kind"]>(driver.kind ?? "delivery");
  const [photo, setPhoto] = useState(driver.photo ?? "");
  const [uploading, setUploading] = useState(false);
  const photoRef = useRef<HTMLInputElement | null>(null);
  const [cashLimit, setCashLimit] = useState(String(driver.cashLimit));
  const [active, setActive] = useState(driver.active);
  const [resetCash, setResetCash] = useState(false);
  const [status, setStatus] = useState<Driver["status"]>(driver.status);

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-surface-20 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label={`Manage ${driver.name}`}
        className="w-full max-w-md rounded-[10px] bg-surface p-5 shadow-[var(--shadow-float)]"
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
            kind,
            photo: photo || undefined,
          });
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{driver.name}</h2>
            <p className="flex items-center gap-1 text-[11px] font-bold text-muted">
              {driver.citySlug} · {driver.deliveries} deliveries ·
              <Star size={10} className="fill-saffron text-saffron" />
              {driver.rating}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-[6px] border border-line text-muted hover:text-ink"
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
            <span className="label">Works as</span>
            <select
              value={kind ?? "delivery"}
              onChange={(event) => setKind(event.target.value as Driver["kind"])}
              className="input"
            >
              <option value="delivery">Delivery courier</option>
              <option value="taxi">Taxi driver</option>
              <option value="both">Delivery + taxi</option>
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-3 rounded-[8px] border border-line p-3">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo}
                alt={`${driver.name} preview`}
                className="h-14 w-14 rounded-[8px] object-cover"
              />
            ) : (
              <span className="grid h-14 w-14 place-items-center rounded-[8px] bg-surface-2 text-muted">
                <Bike size={19} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold">Driver photo</div>
              <div className="text-[11px] text-muted">
                Shown to dispatch and riders when accepted.
              </div>
            </div>
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setUploading(true);
                try {
                  setPhoto(await resizePhoto(file));
                } finally {
                  setUploading(false);
                }
              }}
            />
            <button
              type="button"
              onClick={() => photoRef.current?.click()}
              disabled={uploading}
              className="btn btn-ghost btn-sm"
            >
              {uploading ? <Loader2 size={12} className="animate-spin" /> : null}
              {photo ? "Replace" : "Upload"}
            </button>
            {photo ? (
              <button
                type="button"
                onClick={() => setPhoto("")}
                className="btn btn-ghost btn-sm text-danger"
              >
                Remove
              </button>
            ) : null}
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
          <label className="flex items-center justify-between gap-3 rounded-[6px] bg-surface-2 px-3 py-2">
            <span className="text-[11px] font-semibold">Active courier</span>
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
              className="h-4 w-4 accent-teal"
            />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-[6px] bg-surface-2 px-3 py-2">
            <span>
              <span className="block text-[11px] font-semibold">Reset cash on hand</span>
              <span className="block text-[11px] text-muted">
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

function DriverPanel({
  title,
  subtitle,
  icon,
  drivers,
  busy,
  onAdd,
  onManage,
}: {
  title: string;
  subtitle: string;
  icon: "delivery" | "taxi";
  drivers: Driver[];
  busy: string;
  onAdd: () => void;
  onManage: (driver: Driver) => void;
}) {
  const Icon = icon === "taxi" ? CarTaxiFront : Bike;
  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[6px] bg-brand-soft text-brand">
            <Icon size={17} />
          </span>
          <div>
            <h3 className="text-[15px] font-semibold">{title}</h3>
            <p className="mt-0.5 max-w-[36ch] text-[11px] leading-4 text-muted">
              {subtitle}
            </p>
          </div>
        </div>
        <button type="button" onClick={onAdd} className="btn btn-primary btn-sm">
          <Plus size={12} /> Generate credentials
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {drivers.length ? (
          drivers.map((driver) => (
            <article key={driver.id} className="aero-tile flex flex-wrap items-center gap-3 rounded-[8px] border p-3">
              {driver.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={driver.photo}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-[6px] object-cover"
                />
              ) : (
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[6px] bg-brand-soft text-brand">
                  <Icon size={17} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-[13px] font-semibold">{driver.name}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
                      !driver.active
                        ? "bg-danger-soft text-danger"
                        : driver.status === "available"
                          ? "bg-brand-soft text-brand"
                          : driver.status === "busy"
                            ? "bg-saffron/20 text-ink"
                            : "bg-surface-2 text-muted"
                    }`}
                  >
                    {driver.active ? driver.status : "inactive"}
                  </span>
                </div>
                <div className="truncate text-[10px] text-muted">
                  {driver.citySlug} · {driver.vehicle}
                  {driver.plate ? ` · ${driver.plate}` : ""}
                  {driver.kind === "both" ? " · both" : ""}
                </div>
                <div className="mt-1 flex items-center gap-3 text-[10px] text-muted">
                  <span>{driver.deliveries} trips</span>
                  <span className="tnum">{money(driver.cashOnHand)} cash</span>
                  <span>{driver.email}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onManage(driver)}
                disabled={busy === driver.id}
                className="btn btn-ghost btn-sm shrink-0"
              >
                <Pencil size={11} /> Manage
              </button>
            </article>
          ))
        ) : (
          <div className="rounded-[8px] border border-dashed border-line px-4 py-8 text-center text-[12px] text-muted">
            No {icon === "taxi" ? "taxi drivers" : "delivery couriers"} yet.
          </div>
        )}
      </div>
    </section>
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
  const available = drivers.filter(
    (driver) => driver.status !== "offline" && driver.kind !== "taxi",
  );

  return (
    <article className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold">{order.code}</span>
            <span className="pill">{meta.label}</span>
            {order.status === "ready" ? (
              <span className="pill pill-warm">
                <Clock3 size={10} /> waiting dispatch
              </span>
            ) : null}
          </div>
          <div className="mt-1 text-[11px] font-bold text-muted">
            {order.citySlug} · {timeAgo(order.createdAt)} · {order.customerName}
          </div>
        </div>
        <div className="text-end">
          <div className="text-base font-semibold">{money(order.total)}</div>
          <div className="text-[11px] font-medium text-brand">COD</div>
        </div>
      </div>

      <div className="mt-3 flex items-start gap-2 text-[11px] leading-4 text-muted">
        <MapPin size={12} className="mt-0.5 shrink-0 text-brand" />
        <span>
          <span className="font-semibold text-muted">{order.store?.name}</span> ·{" "}
          {order.address}, {order.landmark}
        </span>
      </div>

      {!compact ? (
        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
          {order.items.map((item) => (
            <span key={item.productId} className="rounded-[6px] bg-surface-2 px-2 py-1 font-bold text-muted">
              {item.qty}× {item.name}
            </span>
          ))}
        </div>
      ) : null}

      {!terminal && (order.deliveryPin || order.pickupCode) ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-[6px] border border-line bg-surface-2/60 px-3 py-2">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Handover code
            </div>
            <div className="text-[11px] text-muted">
              Customer shares this at the door
            </div>
          </div>
          <div className="font-display text-[22px] font-semibold tracking-[0.12em] text-ink tnum">
            {(order.fulfillment === "pickup" ? order.pickupCode : order.deliveryPin)
              ?.replace(/\D/g, "")
              .slice(-4)}
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        {order.driver ? (
          <span className="inline-flex items-center gap-1 rounded-[6px] bg-brand-soft px-2 py-1 text-[11px] font-semibold text-brand">
            {order.driver.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={order.driver.photo}
                alt=""
                className="h-5 w-5 rounded-full object-cover"
              />
            ) : (
              <Bike size={11} />
            )}{" "}
            {order.driver.name}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-[6px] bg-surface-2 px-2 py-1 text-[11px] font-bold text-muted">
            <Bike size={11} /> no driver
          </span>
        )}

        {canAssign ? (
          <>
            <select
              value={chosenDriver || ""}
              onChange={(event) => onChooseDriver(event.target.value)}
              className="h-8 rounded-[6px] border border-line bg-surface px-2 text-[11px] font-bold"
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
            className="ms-auto h-8 rounded-[6px] border border-line bg-surface px-2 text-[11px] font-bold text-muted"
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
          <span className="ms-auto text-[11px] font-medium text-muted">
            closed
          </span>
        )}
      </div>
    </article>
  );
}


function CityServicesModal({
  city,
  busy,
  onClose,
  onSave,
}: {
  city: City;
  busy: boolean;
  onClose: () => void;
  onSave: (services: Partial<Record<CityService, boolean>>) => void;
}) {
  const [draft, setDraft] = useState(() => cityServices(city));
  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-ink/55 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Services in ${city.name}`}
        className="my-6 w-full max-w-lg rounded-[12px] bg-surface p-5 shadow-[var(--shadow-float)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-[24px] font-semibold tracking-[-0.03em]">
              {city.name} services
            </h2>
            <p className="mt-1 text-[11px] leading-5 text-muted">
              Enable each service only when supply and operations are ready.
              Turning one off never disables the others.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-[6px] text-muted hover:bg-surface-2 hover:text-ink"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 divide-y divide-line border-y border-line">
          {CITY_SERVICES.map((service) => (
            <label
              key={service.id}
              className="flex cursor-pointer items-center gap-3 py-3"
            >
              <input
                type="checkbox"
                checked={draft[service.id]}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    [service.id]: event.target.checked,
                  }))
                }
                className="h-4 w-4 accent-teal"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold">
                  {service.label}
                </span>
                <span className="block text-[11px] text-muted">
                  {service.description}
                </span>
              </span>
              <span
                className={`rounded-[2px] px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
                  draft[service.id]
                    ? "bg-success-soft text-success"
                    : "bg-surface-2 text-muted"
                }`}
              >
                {draft[service.id] ? "On" : "Off"}
              </span>
            </label>
          ))}
        </div>

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost flex-1">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onSave(draft)}
            className="btn btn-primary flex-1"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            {busy ? "Saving…" : "Save services"}
          </button>
        </div>
      </div>
    </div>
  );
}
