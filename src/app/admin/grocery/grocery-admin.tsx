"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  Boxes,
  Check,
  ImagePlus,
  Loader2,
  PackagePlus,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import type { City, Product, RefundRequest, Store } from "@/lib/types";
import { stockBadge } from "@/lib/grocery";
import { useI18n } from "@/components/locale-provider";
import { money, timeAgo } from "@/lib/utils";
import { resizeImage } from "@/lib/image-client";
import { storePhoto } from "@/lib/store-images";

export function GroceryAdmin({
  stores: initialStores,
  cities,
  initialProducts,
  initialRefunds,
}: {
  stores: Store[];
  cities: City[];
  initialProducts: Product[];
  initialRefunds: RefundRequest[];
}) {
  const { t } = useI18n();
  const [stores, setStores] = useState(initialStores);
  const [products, setProducts] = useState(initialProducts);
  const [refunds, setRefunds] = useState(initialRefunds);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [editor, setEditor] = useState<{ open: boolean; store?: Store } | null>(null);

  async function removeStore(store: Store) {
    if (
      !window.confirm(
        `Delete ${store.name}, its catalogue and stock? This cannot be undone.`,
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
        setMessage(data.error || t("Could not delete the store"));
        return;
      }
      setStores((current) => current.filter((item) => item.id !== store.id));
      setProducts((current) => current.filter((item) => item.storeId !== store.id));
      setMessage(t("Store deleted"));
    } finally {
      setBusy("");
    }
  }

  const storeName = useMemo(
    () => new Map(stores.map((store) => [store.id, store.name])),
    [stores],
  );
  const stats = useMemo(() => {
    let low = 0;
    let out = 0;
    let value = 0;
    for (const product of products) {
      const stock = product.variants?.length
        ? product.variants.reduce((sum, variant) => sum + variant.stock, 0)
        : product.stock;
      if (stock === 0) out += 1;
      else if (stock !== undefined && stock <= (product.lowStockThreshold ?? 5)) low += 1;
      value += (stock ?? 0) * product.price;
    }
    return { low, out, value };
  }, [products]);

  async function adjust(product: Product, delta: number) {
    if (typeof product.stock !== "number") return;
    setBusy(product.id);
    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock: Math.max(0, product.stock + delta) }),
      });
      const data = (await response.json()) as { product?: Product; error?: string };
      if (response.ok && data.product) {
        setProducts((current) =>
          current.map((item) => (item.id === data.product!.id ? data.product! : item)),
        );
        setMessage(t("Stock updated"));
      } else {
        setMessage(data.error || t("Could not update stock"));
      }
    } finally {
      setBusy("");
    }
  }

  async function moveRefund(refund: RefundRequest, status: "approved" | "rejected" | "refunded") {
    setBusy(refund.id);
    try {
      const response = await fetch(`/api/refunds/${refund.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, restock: refund.restock }),
      });
      const data = (await response.json()) as { refund?: RefundRequest; error?: string };
      if (response.ok && data.refund) {
        setRefunds((current) =>
          current.map((item) => (item.id === data.refund!.id ? data.refund! : item)),
        );
        setMessage(t("Refund updated"));
      } else {
        setMessage(data.error || t("Could not update the refund"));
      }
    } finally {
      setBusy("");
    }
  }

  const lowStock = products
    .filter((product) => {
      const stock = product.variants?.length
        ? product.variants.reduce((sum, variant) => sum + variant.stock, 0)
        : product.stock;
      return stock !== undefined && stock <= (product.lowStockThreshold ?? 5);
    })
    .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0))
    .slice(0, 20);

  return (
    <div className="mt-5 space-y-5">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[13px] font-semibold">{t("Grocery stores")}</h2>
            <p className="mt-0.5 text-[11px] text-muted">
              {t("Add, edit or remove supermarkets without touching restaurants.")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditor({ open: true })}
            className="btn btn-primary btn-sm"
          >
            <Plus size={13} /> {t("Add grocery store")}
          </button>
        </div>
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {stores.map((store) => (
            <article key={store.id} className="aero-tile flex flex-wrap items-center gap-3 rounded-[8px] border p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={storePhoto(store)}
                alt=""
                className="h-12 w-16 shrink-0 rounded-[5px] object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-[13px] font-semibold">{store.name}</span>
                  <span
                    className={`rounded-[2px] px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
                      store.isOpen
                        ? "bg-success-soft text-success"
                        : "bg-danger-soft text-danger"
                    }`}
                  >
                    {store.isOpen ? t("Open") : t("Closed")}
                  </span>
                </div>
                <div className="truncate text-[10px] text-muted">
                  {store.citySlug} · {store.landmark} · {money(store.deliveryFee)}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setEditor({ open: true, store })}
                  className="btn btn-ghost btn-sm"
                >
                  <Pencil size={11} /> {t("Edit")}
                </button>
                <button
                  type="button"
                  onClick={() => void removeStore(store)}
                  disabled={busy === store.id}
                  className="btn btn-ghost btn-sm text-danger"
                  title={t("Delete store")}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </article>
          ))}
          {!stores.length ? (
            <div className="rounded-[8px] border border-dashed border-line px-4 py-8 text-center text-[12px] text-muted lg:col-span-2">
              {t("No grocery stores yet.")}
            </div>
          ) : null}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-x-6 gap-y-5 border-t border-line pt-4 lg:grid-cols-4">
        {[
          { label: t("SKUs"), value: products.length },
          { label: t("Low stock"), value: stats.low },
          { label: t("Out of stock"), value: stats.out },
          { label: t("Inventory value"), value: money(stats.value) },
        ].map((item) => (
          <div key={item.label}>
            <div className="text-[11px] text-muted">{item.label}</div>
            <div className="mt-1.5 font-display text-[24px] font-semibold leading-none tracking-[-0.03em] tnum">
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {message ? <div className="border-s-2 border-brand ps-3 text-[13px] text-brand">{message}</div> : null}

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-semibold">{t("Low stock & restock")}</h2>
          <span className="pill">{lowStock.length}</span>
        </div>
        <div className="card mt-3 overflow-hidden">
          <div className="divide-y divide-ink/5">
            {lowStock.map((product) => {
              const stock = product.variants?.length
                ? product.variants.reduce((sum, variant) => sum + variant.stock, 0)
                : product.stock;
              const badge = stockBadge(stock, product.lowStockThreshold ?? 5);
              return (
                <div key={product.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold">{product.name}</div>
                    <div className="text-[11px] font-bold text-muted">
                      {storeName.get(product.storeId)} · {product.sku || t("No SKU")} · {money(product.price)}
                    </div>
                  </div>
                  <span className="rounded-full bg-saffron/20 px-2 py-1 text-[11px] font-semibold uppercase text-saffron-deep">
                    {badge.tone === "low"
                              ? t("Only {count} left", { count: stock ?? 0 })
                              : badge.tone === "out"
                                ? t("Sold out")
                                : t("In stock")}
                  </span>
                  {product.variants?.length ? (
                    <span className="text-[11px] font-bold text-muted">
                      {product.variants.length} {t("variants")}
                    </span>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => adjust(product, -1)}
                        disabled={busy === product.id}
                        className="grid h-8 w-8 place-items-center rounded-[6px] border border-line"
                      >
                        −
                      </button>
                      <button
                        type="button"
                        onClick={() => adjust(product, 5)}
                        disabled={busy === product.id}
                        className="btn btn-ghost btn-sm"
                      >
                        {busy === product.id ? <Loader2 size={12} className="animate-spin" /> : "+5"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {!lowStock.length ? (
              <div className="px-6 py-8 text-center text-sm font-bold text-muted">
                {t("Everything is above the low-stock threshold.")}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-semibold">{t("Refund requests")}</h2>
          <span className="pill">
            {refunds.filter((refund) => refund.status === "pending").length} {t("pending")}
          </span>
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {refunds.map((refund) => (
            <div key={refund.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[13px] font-semibold">{refund.orderId}</div>
                  <div className="text-[11px] font-bold text-muted">
                    {timeAgo(refund.createdAt)} · {refund.lines.length} {t("lines")}
                  </div>
                </div>
                <span className="pill">{t(refund.status)}</span>
              </div>
              <p className="mt-2 text-xs text-muted">{refund.reason}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm font-semibold">{money(refund.amount)}</span>
                {refund.status === "pending" ? (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => moveRefund(refund, "approved")}
                      disabled={busy === refund.id}
                      className="btn btn-primary btn-sm"
                    >
                      <Check size={12} /> {t("Approve")}
                    </button>
                    <button
                      type="button"
                      onClick={() => moveRefund(refund, "rejected")}
                      disabled={busy === refund.id}
                      className="btn btn-ghost btn-sm"
                    >
                      <X size={12} /> {t("Reject")}
                    </button>
                  </div>
                ) : refund.status === "approved" ? (
                  <button
                    type="button"
                    onClick={() => moveRefund(refund, "refunded")}
                    disabled={busy === refund.id}
                    className="btn btn-primary btn-sm"
                  >
                    <RotateCcw size={12} /> {t("Mark refunded")}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          {!refunds.length ? (
            <div className="card grid place-items-center px-6 py-10 text-center text-sm font-bold text-muted lg:col-span-2">
              {t("No refund requests yet.")}
            </div>
          ) : null}
        </div>
      </section>

      {editor?.open ? (
        <GroceryStoreEditor
          store={editor.store}
          cities={cities}
          onClose={() => setEditor(null)}
          onSaved={(store) => {
            setStores((current) =>
              current.some((item) => item.id === store.id)
                ? current.map((item) => (item.id === store.id ? store : item))
                : [store, ...current],
            );
            setEditor(null);
            setMessage(t("Grocery store saved"));
          }}
        />
      ) : null}
    </div>
  );
}

type StoreDraft = {
  name: string;
  nameAr: string;
  citySlug: string;
  phone: string;
  address: string;
  landmark: string;
  deliveryFee: string;
  minOrder: string;
  prepTime: string;
  image?: string;
};

function GroceryStoreEditor({
  store,
  cities,
  onClose,
  onSaved,
}: {
  store?: Store;
  cities: City[];
  onClose: () => void;
  onSaved: (store: Store) => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<StoreDraft>(() => ({
    name: store?.name ?? "",
    nameAr: store?.nameAr ?? "",
    citySlug: store?.citySlug ?? cities.find((city) => city.priority)?.slug ?? "dakhla",
    phone: store?.phone ?? "",
    address: store?.address ?? "",
    landmark: store?.landmark ?? "",
    deliveryFee: String(store?.deliveryFee ?? 12),
    minOrder: String(store?.minOrder ?? 30),
    prepTime: String(store?.prepTime ?? 30),
    image: store?.image,
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set<K extends keyof StoreDraft>(key: K, value: StoreDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: draft.name,
        nameAr: draft.nameAr,
        citySlug: draft.citySlug,
        category: "grocery",
        phone: draft.phone,
        address: draft.address,
        landmark: draft.landmark,
        deliveryFee: Number(draft.deliveryFee),
        minOrder: Number(draft.minOrder),
        prepTime: Number(draft.prepTime),
        image: draft.image,
        isOpen: store?.isOpen ?? true,
      };
      const response = await fetch("/api/admin/stores", {
        method: store ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          store ? { storeId: store.id, patch: payload } : payload,
        ),
      });
      const data = (await response.json()) as { store?: Store; error?: string };
      if (!response.ok || !data.store) {
        setError(data.error || t("Could not save the store"));
        return;
      }
      onSaved(data.store);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-ink/55 p-4"
      role="presentation"
      onClick={onClose}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label={store ? t("Edit grocery store") : t("Add grocery store")}
        className="my-6 w-full max-w-xl rounded-[12px] bg-surface p-5 shadow-[var(--shadow-float)]"
        onClick={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-[24px] font-semibold tracking-[-0.03em]">
              {store ? t("Edit grocery store") : t("Add grocery store")}
            </h2>
            <p className="mt-1 text-[11px] text-muted">
              {t("Only grocery partners are listed here. Restaurant stores stay in the main store list.")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-[6px] text-muted hover:bg-surface-2 hover:text-ink"
            aria-label={t("Close")}
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-[8px] border border-line p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={draft.image || "/images/stores/grocery-1.jpg"}
            alt=""
            className="h-16 w-24 rounded-[6px] object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold">{t("Store cover")}</div>
            <div className="text-[11px] text-muted">{t("Shown on the grocery storefront.")}</div>
          </div>
          <label className="btn btn-ghost btn-sm cursor-pointer">
            {t("Upload")}
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
                  quality: 0.8,
                });
                set("image", image);
              }}
            />
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">{t("Store name")}</span>
            <input className="input" value={draft.name} onChange={(event) => set("name", event.target.value)} required />
          </label>
          <label className="block">
            <span className="label">{t("Arabic name")}</span>
            <input className="input arabic" value={draft.nameAr} onChange={(event) => set("nameAr", event.target.value)} />
          </label>
          <label className="block">
            <span className="label">{t("City")}</span>
            <select className="input" value={draft.citySlug} onChange={(event) => set("citySlug", event.target.value)}>
              {cities.map((city) => (
                <option key={city.slug} value={city.slug}>{city.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">{t("Phone")}</span>
            <input className="input" value={draft.phone} onChange={(event) => set("phone", event.target.value)} />
          </label>
          <label className="block sm:col-span-2">
            <span className="label">{t("Address")}</span>
            <input className="input" value={draft.address} onChange={(event) => set("address", event.target.value)} />
          </label>
          <label className="block sm:col-span-2">
            <span className="label">{t("Landmark")}</span>
            <input className="input" value={draft.landmark} onChange={(event) => set("landmark", event.target.value)} />
          </label>
          <label className="block">
            <span className="label">{t("Delivery fee (MAD)")}</span>
            <input className="input" type="number" min={0} value={draft.deliveryFee} onChange={(event) => set("deliveryFee", event.target.value)} />
          </label>
          <label className="block">
            <span className="label">{t("Minimum order (MAD)")}</span>
            <input className="input" type="number" min={0} value={draft.minOrder} onChange={(event) => set("minOrder", event.target.value)} />
          </label>
          <label className="block">
            <span className="label">{t("Prep time (min)")}</span>
            <input className="input" type="number" min={5} value={draft.prepTime} onChange={(event) => set("prepTime", event.target.value)} />
          </label>
        </div>

        {error ? (
          <p className="mt-3 rounded-[6px] bg-danger-soft px-3 py-2 text-[11px] font-medium text-danger">{error}</p>
        ) : null}

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost flex-1">{t("Cancel")}</button>
          <button type="submit" disabled={saving} className="btn btn-primary flex-1">
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {saving ? t("Saving…") : t("Save grocery store")}
          </button>
        </div>
      </form>
    </div>
  );
}
