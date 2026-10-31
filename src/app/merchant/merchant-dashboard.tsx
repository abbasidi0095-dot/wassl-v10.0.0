"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  Bell,
  BellOff,
  CheckCircle2,
  ChefHat,
  Clock3,
  MapPin,
  PackageCheck,
  PackagePlus,
  PauseCircle,
  PlayCircle,
  Plus,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  ImagePlus,
  Loader2,
  Star,
  TrendingUp,
  Truck,
  Utensils,
  X,
} from "lucide-react";
import type { OrderView } from "@/lib/db";
import { ProductTile } from "@/components/product-icon";
import type { Product, Store } from "@/lib/types";
import { STATUS_META } from "@/lib/types";
import { money, timeAgo } from "@/lib/utils";
import { useLiveEvents } from "@/lib/use-live-events";
import { resizeImage } from "@/lib/image-client";
import { storePhoto } from "@/lib/store-images";

type Tab = "orders" | "menu" | "store";

export function MerchantDashboard({
  store: initialStore,
  initialProducts,
  initialOrders,
}: {
  store: Store;
  initialProducts: Product[];
  initialOrders: OrderView[];
}) {
  const [store, setStore] = useState(initialStore);
  const [products, setProducts] = useState(initialProducts);
  const [orders, setOrders] = useState(initialOrders);
  const [tab, setTab] = useState<Tab>("orders");
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const placedCount = useRef(
    initialOrders.filter((order) => order.status === "placed").length,
  );

  const active = orders.filter((order) => !["delivered", "cancelled"].includes(order.status));
  const newOrders = orders.filter((order) => order.status === "placed");
  const delivered = orders.filter((order) => order.status === "delivered");
  const gmv = delivered.reduce((sum, order) => sum + order.total, 0);
  const commission = Math.round((gmv * store.commissionRate) / 100);

  const stats = [
    { label: "New orders", value: `${newOrders.length}`, icon: Bell },
    { label: "In progress", value: `${active.length}`, icon: ChefHat },
    { label: "Delivered", value: `${delivered.length}`, icon: PackageCheck },
    { label: "Revenue", value: money(gmv), icon: Banknote },
  ];

  async function refreshOrders(silent = false) {
    if (!silent) setRefreshing(true);
    try {
      const response = await fetch(`/api/orders?storeId=${store.id}`, { cache: "no-store" });
      if (response.ok) {
        const data = (await response.json()) as { orders: OrderView[] };
        setOrders(data.orders);
      }
    } finally {
      if (!silent) setRefreshing(false);
    }
  }

  useLiveEvents({ storeId: store.id }, () => {
    void refreshOrders(true);
  });

  useEffect(() => {
    const timer = window.setInterval(() => refreshOrders(true), 10000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.id]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const next = orders.filter((order) => order.status === "placed").length;
    if (next > placedCount.current && soundOn) chime();
    placedCount.current = next;
  }, [orders, soundOn]);

  useEffect(() => {
    const apply = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash === "orders" || hash === "menu" || hash === "store") setTab(hash);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  async function setStatus(orderId: string, status: string, note?: string, proofPin?: string) {
    setBusy(orderId);
    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note, proofPin }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setToast(data.error || "Could not update the order");
        return;
      }
      await refreshOrders(true);
      setToast(status === "accepted" ? "Order accepted" : "Order updated");
    } finally {
      setBusy("");
    }
  }

  async function updateCover(file?: File) {
    if (!file) return;
    setCoverUploading(true);
    try {
      const image = await resizeImage(file, {
        width: 1200,
        height: 800,
        fit: "cover",
        quality: 0.8,
      });
      const response = await fetch("/api/merchant/store", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const data = (await response.json()) as { store?: Store; error?: string };
      if (!response.ok || !data.store) {
        setToast(data.error || "Could not save the cover photo");
        return;
      }
      setStore(data.store);
      setToast("Cover photo updated");
    } finally {
      setCoverUploading(false);
    }
  }

  async function toggleStore() {
    setBusy("store");
    try {
      const response = await fetch("/api/merchant/store", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOpen: !store.isOpen }),
      });
      if (response.ok) {
        setStore((current) => ({ ...current, isOpen: !current.isOpen }));
        setToast(store.isOpen ? "Store paused" : "Store opened");
      }
    } finally {
      setBusy("");
    }
  }

  async function updateProductImage(product: Product, file?: File) {
    if (!file) return;
    setBusy(product.id);
    try {
      const image = await resizeImage(file, {
        width: 640,
        height: 640,
        fit: "cover",
      });
      const response = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const data = (await response.json()) as { product?: Product; error?: string };
      if (!response.ok || !data.product) {
        setToast(data.error || "Could not save the item photo");
        return;
      }
      setProducts((current) =>
        current.map((item) => (item.id === product.id ? data.product! : item)),
      );
      setToast("Item photo updated");
    } finally {
      setBusy("");
    }
  }

  async function toggleProduct(product: Product) {
    setBusy(product.id);
    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: !product.available }),
      });
      if (response.ok) {
        setProducts((current) =>
          current.map((item) =>
            item.id === product.id ? { ...item, available: !item.available } : item,
          ),
        );
      }
    } finally {
      setBusy("");
    }
  }

  async function addProduct(input: {
    name: string;
    category: string;
    price: number;
    description: string;
    image?: string;
    popular: boolean;
    available: boolean;
  }) {
    setSaving(true);
    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, storeId: store.id }),
      });
      const data = (await response.json()) as { product?: Product; error?: string };
      if (!response.ok || !data.product) {
        setToast(data.error || "Could not add the item");
        return;
      }
      setProducts((current) => [...current, data.product as Product]);
      setToast(`${data.product.name} added to the menu`);
      setAddOpen(false);
    } finally {
      setSaving(false);
    }
  }

  const tabs: { id: Tab; label: string; icon: typeof Bell }[] = [
    { id: "orders", label: "Order board", icon: ReceiptText },
    { id: "menu", label: "Menu & stock", icon: Utensils },
    { id: "store", label: "Store & money", icon: TrendingUp },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="eyebrow">{store.citySlug} · live store</div>
          <h1 className="display mt-2 text-[clamp(1.9rem,1.5rem+1.4vw,2.7rem)]">{store.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Star size={12} className="fill-signal text-signal" />
              <span className="tnum">
                {store.rating} · {store.reviews} reviews
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock3 size={12} className="text-brand" />
              Prep {store.prepTime} min
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={12} className="text-brand" />
              {store.landmark}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`flex items-center gap-2.5 rounded-[6px] border px-3 py-2 ${
              store.isOpen
                ? "border-line bg-success-soft/60 text-success"
                : "border-line bg-signal-soft text-signal-ink"
            }`}
          >
            <span className={`status-dot ${store.isOpen ? "live-dot" : ""}`} />
            <div>
              <div className="text-[10px] font-medium text-muted">
                Store status
              </div>
              <div className="text-[11px] font-semibold">
                {store.isOpen ? "Accepting orders" : "Paused"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleStore}
            disabled={busy === "store"}
            className={`btn ${store.isOpen ? "btn-ghost" : "btn-primary"}`}
          >
            {store.isOpen ? <PauseCircle size={15} /> : <PlayCircle size={15} />}
            {store.isOpen ? "Pause store" : "Open store"}
          </button>
          <button type="button" onClick={() => refreshOrders()} className="btn btn-ghost">
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <div className="mt-7 grid grid-cols-2 border-t border-line lg:grid-cols-4">
        {stats.map((item, index) => (
          <div
            key={item.label}
            className={`py-4 ${
              index % 2 === 1 ? "border-s border-line ps-4" : ""
            } ${index > 1 ? "border-t border-line lg:border-t-0" : ""} ${
              index > 1 ? "lg:border-s lg:border-line lg:ps-5" : ""
            } lg:ps-5 lg:[&:nth-child(1)]:ps-0`}
          >
            <div className="flex items-center gap-1.5 text-[11px] text-muted">
              <item.icon size={12} strokeWidth={1.7} />
              {item.label}
            </div>
            <div className="mt-1.5 font-display text-[26px] font-semibold leading-none tracking-[-0.03em] tnum">
              {item.value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-7 flex gap-5 overflow-x-auto border-b border-line scrollbar-none">
        {tabs.map((item) => (
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
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-[6px] bg-ink px-4 py-2.5 text-[12px] font-medium text-on-dark shadow-[var(--shadow-float)]">
          {toast}
        </div>
      ) : null}

      {tab === "orders" ? (
        <section className="mt-4" id="orders">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[22px] font-semibold tracking-[-0.025em]">Live order board</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSoundOn((value) => !value)}
                className="btn btn-ghost btn-sm"
                aria-pressed={soundOn}
              >
                {soundOn ? <Bell size={13} /> : <BellOff size={13} />}
                {soundOn ? "Sound on" : "Sound off"}
              </button>
              <span className="hidden text-[11px] text-muted tnum sm:block">
                {active.length} active
              </span>
            </div>
          </div>
          {orders.length ? (
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {orders.map((order) => (
                <MerchantOrderCard
                  key={order.id}
                  order={order}
                  busy={busy === order.id}
                  onStatus={(status, note, proofPin) => setStatus(order.id, status, note, proofPin)}
                />
              ))}
            </div>
          ) : (
            <div className="mt-3 grid place-items-center rounded-[10px] border border-dashed border-line px-6 py-16 text-center">
              <ShoppingBag size={26} strokeWidth={1.4} className="text-muted" />
              <h3 className="mt-4 font-display text-[19px] font-semibold tracking-[-0.02em]">
                No orders yet
              </h3>
              <p className="mt-1.5 max-w-[36ch] text-[12px] leading-5 text-muted">
                New orders appear here automatically, with a sound when the board is
                quiet.
              </p>
            </div>
          )}
        </section>
      ) : null}

      {tab === "menu" ? (
        <section className="mt-4" id="menu">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-[22px] font-semibold tracking-[-0.025em]">
                Menu & stock
              </h2>
              <p className="mt-1 max-w-[46ch] text-[12px] leading-5 text-muted">
                Add dishes, set prices, and toggle an item off when it sells out.
                Customers see sold-out items as unavailable.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="pill">{products.length} items</span>
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="btn btn-primary btn-sm"
              >
                <Plus size={14} />
                Add item
              </button>
            </div>
          </div>

          {products.length ? (
            <div className="card mt-3 overflow-hidden">
              {/* Mobile: stacked rows so every control fits without sideways scrolling */}
              <div className="divide-y divide-line md:hidden">
                {products.map((product) => (
                  <div key={product.id} className="flex items-start gap-3 p-3">
                    <ProductTile
                      name={product.name}
                      category={product.category}
                      image={product.image}
                      className="h-11 w-11 shrink-0 rounded-[6px]"
                      iconSize={20}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-semibold">
                            {product.name}
                          </div>
                          <div className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-muted">
                            {product.description}
                          </div>
                        </div>
                        <span className="shrink-0 text-[13px] font-semibold tnum">
                          {money(product.price)}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="max-w-[9rem] truncate rounded-[2px] bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted">
                            {product.category}
                          </span>
                          <span
                            className={`shrink-0 text-[11px] font-medium ${
                              product.available ? "text-success" : "text-danger"
                            }`}
                          >
                            {product.available ? "Available" : "Sold out"}
                          </span>
                        </div>
                        <label className="btn btn-ghost btn-sm shrink-0 cursor-pointer">
                          <ImagePlus size={12} /> Photo
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            onChange={(event) =>
                              void updateProductImage(product, event.target.files?.[0])
                            }
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => toggleProduct(product)}
                          disabled={busy === product.id}
                          className="btn btn-ghost btn-sm shrink-0"
                        >
                          {product.available ? "Mark sold out" : "Restore"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: full data table */}
              <div className="table-wrap hidden md:block">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            <ProductTile
                              name={product.name}
                              category={product.category}
                              image={product.image}
                              className="h-8 w-8 rounded-[4px]"
                              iconSize={15}
                            />
                            <div>
                              <div className="font-semibold">{product.name}</div>
                              <div className="max-w-[220px] truncate text-[11px] text-muted">
                                {product.description}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="text-muted">{product.category}</td>
                        <td className="font-semibold tnum">{money(product.price)}</td>
                        <td>
                          <span
                            className={`rounded-[2px] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] ${
                              product.available
                                ? "bg-success-soft text-success"
                                : "bg-danger-soft text-danger"
                            }`}
                          >
                            {product.available ? "Available" : "Sold out"}
                          </span>
                        </td>
                        <td className="text-end">
                          <div className="flex justify-end gap-1">
                            <label className="btn btn-ghost btn-sm cursor-pointer">
                              <ImagePlus size={12} /> Photo
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                className="hidden"
                                onChange={(event) =>
                                  void updateProductImage(product, event.target.files?.[0])
                                }
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => toggleProduct(product)}
                              disabled={busy === product.id}
                              className="btn btn-ghost btn-sm"
                            >
                              {product.available ? "Mark sold out" : "Restore"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="mt-3 grid place-items-center rounded-[10px] border border-dashed border-line px-6 py-14 text-center">
              <Utensils size={26} strokeWidth={1.4} className="text-muted" />
              <h3 className="mt-4 font-display text-[19px] font-semibold tracking-[-0.02em]">
                Your menu is empty
              </h3>
              <p className="mt-1.5 max-w-[38ch] text-[12px] leading-5 text-muted">
                Add your first item so customers can start ordering from {store.name}.
              </p>
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="btn btn-primary mt-4"
              >
                <Plus size={15} />
                Add item
              </button>
            </div>
          )}
        </section>
      ) : null}

      {tab === "store" ? (
        <section className="mt-4 grid gap-4 lg:grid-cols-2" id="store">
          <div className="card p-5">
            <h2 className="font-display text-[20px] font-semibold tracking-[-0.02em]">
              Store profile
            </h2>
            <div className="mt-4 overflow-hidden rounded-[8px] border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={storePhoto(store)}
                alt={`${store.name} cover`}
                className="aspect-[16/9] w-full object-cover"
              />
              <div className="flex flex-wrap items-center gap-2 border-t border-line p-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold">Restaurant cover</div>
                  <div className="text-[10px] text-muted">
                    Shown at the top of your storefront.
                  </div>
                </div>
                <label className="btn btn-ghost btn-sm cursor-pointer">
                  {coverUploading ? <Loader2 size={12} className="animate-spin" /> : null}
                  {coverUploading ? "Saving…" : "Change photo"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => void updateCover(event.target.files?.[0])}
                  />
                </label>
              </div>
            </div>
            <div className="mt-4 space-y-3 text-[13px]">
              {[
                ["Store name", store.name],
                ["Arabic name", store.nameAr],
                ["City", store.citySlug],
                ["Address", store.address],
                ["Landmark", store.landmark],
                ["Phone", store.phone],
                ["Delivery fee", money(store.deliveryFee)],
                ["Minimum order", money(store.minOrder)],
                ["Commission", `${store.commissionRate}%`],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-4 border-b border-line pb-2 last:border-b-0">
                  <span className="text-muted">{label}</span>
                  <span className="text-end font-medium">{value}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-[6px] bg-surface-2 px-3 py-2 text-[11px] text-muted tnum">
              <MapPin size={13} className="text-brand" />
              {store.lat.toFixed(4)}, {store.lng.toFixed(4)}
            </div>
          </div>

          <div className="space-y-4">
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-[20px] font-semibold tracking-[-0.02em]">
                  Settlement
                </h2>
                <Banknote size={18} className="text-brand" />
              </div>
              <p className="mt-1 text-[12px] text-muted">
                Delivered cash orders minus Wassl commission.
              </p>
              <div className="mt-4 space-y-2 text-[13px]">
                <div className="flex justify-between text-muted">
                  <span>Delivered GMV</span>
                  <span className="font-semibold text-ink tnum">{money(gmv)}</span>
                </div>
                <div className="flex justify-between text-muted">
                  <span>Commission ({store.commissionRate}%)</span>
                  <span className="font-semibold text-danger tnum">− {money(commission)}</span>
                </div>
                <div className="flex justify-between border-t border-line pt-2 text-[15px] font-semibold">
                  <span>Net payout</span>
                  <span className="tnum">{money(gmv - commission)}</span>
                </div>
              </div>
              <p className="mt-4 rounded-[6px] bg-signal-soft px-3 py-2.5 text-[11px] leading-5 text-signal-ink">
                Weekly settlement · next payout on Sunday. COD is collected by the
                driver and confirmed by dispatch.
              </p>
            </div>
            <div className="card p-5">
              <h2 className="font-display text-[17px] font-semibold tracking-[-0.02em]">
                Operational settings
              </h2>
              <div className="mt-3 flex items-center justify-between gap-4 rounded-[6px] bg-surface-2 p-3">
                <div>
                  <div className="text-[12px] font-semibold">Accepting orders</div>
                  <div className="mt-0.5 text-[11px] leading-5 text-muted">
                    Customers can browse, but cannot checkout when paused.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleStore}
                  className={`relative h-7 w-12 rounded-full transition ${
                    store.isOpen ? "bg-teal" : "bg-ink/20"
                  }`}
                  aria-label="Toggle store"
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-[#faf9f6] shadow-sm transition ${
                      store.isOpen ? "start-6" : "start-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {addOpen ? (
        <AddItemModal
          categories={Array.from(new Set(products.map((product) => product.category)))}
          saving={saving}
          onClose={() => setAddOpen(false)}
          onSubmit={addProduct}
        />
      ) : null}
    </div>
  );
}

function AddItemModal({
  categories,
  saving,
  onClose,
  onSubmit,
}: {
  categories: string[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (input: {
    name: string;
    category: string;
    price: number;
    description: string;
    image?: string;
    popular: boolean;
    available: boolean;
  }) => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState(categories[0] || "Mains");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [popular, setPopular] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-item-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit({
            name: name.trim(),
            category: category.trim(),
            price: Number(price),
            description: description.trim(),
            image: image || undefined,
            popular,
            available: true,
          });
        }}
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-[10px] bg-surface p-5 shadow-[var(--shadow-float)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="add-item-title"
              className="font-display text-[22px] font-semibold tracking-[-0.025em]"
            >
              Add item
            </h2>
            <p className="mt-1 text-[12px] text-muted">
              It appears on your storefront immediately.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[6px] bg-surface-2 text-muted transition-colors hover:text-ink"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="label">Item name</span>
            <input
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Chicken tagine"
              required
              minLength={2}
              autoFocus
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label">Category</span>
              <input
                className="input"
                list="menu-categories"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="Mains"
                required
              />
              <datalist id="menu-categories">
                {categories.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </label>
            <label className="block">
              <span className="label">Price (MAD)</span>
              <input
                className="input"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="45"
                required
              />
            </label>
          </div>
          <div className="rounded-[8px] border border-line p-3">
            <div className="flex items-center gap-3">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="Item preview" className="h-14 w-14 rounded-[6px] object-cover" />
              ) : (
                <span className="grid h-14 w-14 place-items-center rounded-[6px] bg-surface-2 text-muted">
                  <ImagePlus size={20} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold">Item photo</div>
                <div className="text-[11px] text-muted">Shown on the menu and in the cart.</div>
              </div>
              <label className="btn btn-ghost btn-sm cursor-pointer">
                {uploading ? <Loader2 size={12} className="animate-spin" /> : null}
                {image ? "Replace" : "Upload"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    try {
                      setImage(
                        await resizeImage(file, {
                          width: 640,
                          height: 640,
                          fit: "cover",
                        }),
                      );
                    } finally {
                      setUploading(false);
                    }
                  }}
                />
              </label>
              {image ? (
                <button type="button" onClick={() => setImage("")} className="btn btn-ghost btn-sm text-danger">
                  Remove
                </button>
              ) : null}
            </div>
          </div>
          <label className="block">
            <span className="label">Description</span>
            <textarea
              className="input min-h-[72px] resize-y"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Slow-cooked with olives and preserved lemon."
              rows={3}
            />
          </label>
          <label className="flex items-center gap-2 rounded-[6px] bg-surface-2 p-3">
            <input
              type="checkbox"
              checked={popular}
              onChange={(event) => setPopular(event.target.checked)}
              className="h-4 w-4 accent-[var(--brand)]"
            />
            <span className="text-[12px] font-medium">Show a “Popular” badge</span>
          </label>
        </div>

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost flex-1">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn btn-primary flex-1">
            <Plus size={15} />
            {saving ? "Adding…" : "Add item"}
          </button>
        </div>
      </form>
    </div>
  );
}

function chime() {
  try {
    const AudioCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    const context = new AudioCtor();
    const notes = [880, 1174];
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, context.currentTime + index * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + index * 0.16 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + index * 0.16 + 0.18);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(context.currentTime + index * 0.16);
      oscillator.stop(context.currentTime + index * 0.16 + 0.2);
    });
    window.setTimeout(() => void context.close().catch(() => null), 800);
  } catch {
    // Audio is a nicety; ignore browsers that block it.
  }
}

function MerchantOrderCard({
  order,
  busy,
  onStatus,
}: {
  order: OrderView;
  busy: boolean;
  onStatus: (status: string, note?: string, proofPin?: string) => void;
}) {
  const meta = STATUS_META[order.status];
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const actionable =
    order.status === "placed" ||
    order.status === "accepted" ||
    order.status === "preparing";

  return (
    <article className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[13px] font-semibold tnum">{order.code}</span>
            <span className="pill">{meta.label}</span>
            {order.status === "placed" ? <span className="pill pill-warm">New</span> : null}
          </div>
          <div className="mt-1 text-[11px] text-muted">
            {timeAgo(order.createdAt)} · {order.customerName}
          </div>
        </div>
        <div className="text-end">
          <div className="text-[15px] font-semibold tnum">{money(order.total)}</div>
          <div className="text-[10px] font-medium uppercase tracking-[0.05em] text-muted">
            COD
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-1.5 rounded-[6px] bg-surface-2/70 p-3">
        {order.items.map((item, index) => (
          <div key={`${item.productId}-${index}`} className="flex items-center gap-2 text-[11px]">
            <ProductTile
              name={item.name}
              image={item.image}
              className="h-5 w-5 rounded-[3px]"
              iconSize={11}
            />
            <span className="min-w-0 flex-1 font-medium">
              <span className="block truncate">{item.qty}× {item.name}</span>
              {item.options?.length ? (
                <span className="block truncate text-[10px] text-muted">
                  {item.options.map((option) => option.optionName).join(" · ")}
                </span>
              ) : null}
            </span>
            <span className="font-semibold tnum">{money(item.price * item.qty)}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-start gap-2 text-[11px] leading-4 text-muted">
        <MapPin size={13} className="mt-0.5 shrink-0 text-brand" />
        <span>
          {order.address} · {order.landmark}
          {order.notes ? <span className="mt-0.5 block italic">“{order.notes}”</span> : null}
        </span>
      </div>

      {order.fulfillment || order.deliveryWindow || order.express || order.substitutionPreference ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {order.fulfillment === "pickup" ? (
            <span className="pill">Pickup · code required</span>
          ) : order.express ? (
            <span className="pill pill-warm">Express</span>
          ) : order.deliveryWindow ? (
            <span className="pill">{order.deliveryWindow}</span>
          ) : null}
          {order.substitutionPreference ? (
            <span className="pill">
              Substitution: {order.substitutionPreference}
            </span>
          ) : null}
        </div>
      ) : null}

      {order.driver ? (
        <div className="mt-3 flex items-center gap-2 text-[11px] text-muted">
          <Truck size={13} className="text-brand" />
          {order.driver.name} · {order.driver.vehicle} · {order.driver.plate}
        </div>
      ) : null}

      {actionable ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {order.status === "placed" ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => onStatus("accepted")}
                className="btn btn-primary btn-sm flex-1"
              >
                <CheckCircle2 size={13} /> Accept order
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setRejecting((value) => !value)}
                className="btn btn-danger btn-sm"
              >
                Reject
              </button>
            </>
          ) : null}
          {order.status === "accepted" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onStatus("preparing")}
              className="btn btn-primary btn-sm flex-1"
            >
              <ChefHat size={13} /> Start preparing
            </button>
          ) : null}
          {order.status === "preparing" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onStatus("ready")}
              className="btn btn-primary btn-sm flex-1"
            >
              <PackageCheck size={13} /> Mark ready for pickup
            </button>
          ) : null}
        </div>
      ) : null}

      {rejecting ? (
        <div className="mt-3 rounded-[6px] border border-line bg-danger-soft/50 p-3">
          <div className="text-[11px] font-medium text-danger">
            Why are you rejecting this order?
          </div>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="input mt-2 min-h-16 resize-none text-[11px]"
            placeholder="e.g. Kitchen is out of the main dish"
            autoFocus
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setRejecting(false);
                setReason("");
              }}
              className="btn btn-ghost btn-sm"
            >
              Keep order
            </button>
            <button
              type="button"
              disabled={busy || reason.trim().length < 3}
              onClick={() => onStatus("cancelled", reason.trim())}
              className="btn btn-sm bg-danger text-[#fffaf1] disabled:opacity-40"
            >
              Confirm rejection
            </button>
          </div>
        </div>
      ) : null}

      {order.status === "ready" && order.fulfillment === "pickup" ? (
        <div className="mt-3 rounded-[6px] bg-brand-soft px-3 py-2.5 text-[11px] text-ink">
          <div className="flex items-center justify-between gap-2">
            <span>Customer pickup · ask for the pickup code.</span>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const code = window.prompt("Enter the customer 4-digit pickup code");
                if (code?.trim()) onStatus("delivered", undefined, code.trim());
              }}
              className="btn btn-primary btn-sm shrink-0"
            >
              Complete pickup
            </button>
          </div>
        </div>
      ) : order.status === "ready" ? (
        <div className="mt-3 rounded-[6px] bg-signal-soft px-3 py-2.5 text-[11px] text-signal-ink">
          Waiting for dispatch to assign a driver.
        </div>
      ) : null}
    </article>
  );
}
