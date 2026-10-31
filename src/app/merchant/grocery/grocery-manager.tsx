"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  Boxes,
  Check,
  ChevronDown,
  Clock3,
  Loader2,
  PackagePlus,
  Pencil,
  Plus,
  Save,
  Settings2,
  Sparkles,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import type {
  GrocerySettings,
  GroceryZone,
  Product,
  ProductVariant,
  Store,
} from "@/lib/types";
import { stockBadge } from "@/lib/grocery";
import { useI18n } from "@/components/locale-provider";
import { money } from "@/lib/utils";

type ProductDraft = {
  name: string;
  category: string;
  description: string;
  price: string;
  unit: string;
  sku: string;
  barcode: string;
  brand: string;
  aisle: string;
  stock: string;
  lowStockThreshold: string;
  available: boolean;
  popular: boolean;
  variants: ProductVariant[];
};

function draftFrom(product?: Product): ProductDraft {
  return {
    name: product?.name ?? "",
    category: product?.category ?? "Fresh",
    description: product?.description ?? "",
    price: String(product?.price ?? ""),
    unit: product?.unit ?? "each",
    sku: product?.sku ?? "",
    barcode: product?.barcode ?? "",
    brand: product?.brand ?? "",
    aisle: product?.aisle ?? product?.category ?? "",
    stock: product?.stock === undefined ? "" : String(product.stock),
    lowStockThreshold: String(product?.lowStockThreshold ?? 5),
    available: product?.available ?? true,
    popular: Boolean(product?.popular),
    variants: product?.variants ? product.variants.map((variant) => ({ ...variant })) : [],
  };
}

export function GroceryManager({
  store,
  initialProducts,
  initialSettings,
}: {
  store: Store;
  initialProducts: Product[];
  initialSettings: GrocerySettings;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<"catalog" | "settings">("catalog");
  const [products, setProducts] = useState(initialProducts);
  const [settings, setSettings] = useState(initialSettings);
  const [productDraft, setProductDraft] = useState<ProductDraft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [lowOnly, setLowOnly] = useState(false);

  const stats = useMemo(() => {
    let low = 0;
    let out = 0;
    let value = 0;
    for (const product of products) {
      const stock =
        product.variants?.length
          ? product.variants.reduce((sum, variant) => sum + variant.stock, 0)
          : product.stock;
      if (stock === 0) out += 1;
      else if (stock !== undefined && stock <= (product.lowStockThreshold ?? 5)) low += 1;
      value += (stock ?? 0) * product.price;
    }
    return { low, out, value, count: products.length };
  }, [products]);

  const visible = products.filter((product) => {
    if (!lowOnly) return true;
    const stock =
      product.variants?.length
        ? product.variants.reduce((sum, variant) => sum + variant.stock, 0)
        : product.stock;
    return stock === 0 || (stock !== undefined && stock <= (product.lowStockThreshold ?? 5));
  });

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  async function saveProduct() {
    const draft = productDraft;
    if (!draft) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: draft.name,
        category: draft.category,
        description: draft.description,
        price: Number(draft.price),
        unit: draft.unit,
        sku: draft.sku,
        barcode: draft.barcode,
        brand: draft.brand,
        aisle: draft.aisle,
        stock: draft.stock === "" ? undefined : Number(draft.stock),
        lowStockThreshold: Number(draft.lowStockThreshold),
        available: draft.available,
        popular: draft.popular,
        variants: draft.variants,
      };
      const response = await fetch(
        editingId ? `/api/products/${editingId}` : "/api/products",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, storeId: store.id }),
        },
      );
      const data = (await response.json()) as { product?: Product; error?: string };
      if (!response.ok || !data.product) {
        setError(data.error || t("Could not save the product"));
        return;
      }
      setProducts((current) =>
        editingId
          ? current.map((item) => (item.id === data.product!.id ? data.product! : item))
          : [data.product!, ...current],
      );
      flash(editingId ? t("Product updated") : t("Product added"));
      setProductDraft(null);
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  }

  async function patchProduct(product: Product, patch: Partial<Product>) {
    const response = await fetch(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...patch, storeId: store.id }),
    });
    const data = (await response.json()) as { product?: Product; error?: string };
    if (!response.ok || !data.product) {
      flash(data.error || t("Could not update the product"));
      return;
    }
    setProducts((current) =>
      current.map((item) => (item.id === data.product!.id ? data.product! : item)),
    );
  }

  async function adjustStock(product: Product, delta: number) {
    if (typeof product.stock !== "number") {
      await patchProduct(product, { available: !product.available });
      return;
    }
    await patchProduct(product, { stock: Math.max(0, product.stock + delta) });
  }

  async function saveSettings() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/merchant/grocery", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: store.id, settings }),
      });
      const data = (await response.json()) as { store?: Store; error?: string };
      if (!response.ok) {
        setError(data.error || t("Could not save grocery settings"));
        return;
      }
      flash(t("Grocery settings saved"));
    } finally {
      setSaving(false);
    }
  }

  function updateSetting<K extends keyof GrocerySettings>(key: K, value: GrocerySettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function updateZone(index: number, patch: Partial<GroceryZone>) {
    setSettings((current) => ({
      ...current,
      deliveryZones: current.deliveryZones.map((zone, i) =>
        i === index ? { ...zone, ...patch } : zone,
      ),
    }));
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">{store.citySlug} · {t("Grocery")}</div>
          <h1 className="display mt-2 text-[clamp(1.8rem,1.5rem+1.2vw,2.4rem)]">{store.name}</h1>
          <p className="mt-1 text-[13px] text-muted">
            {t("Catalog, stock, delivery zones and 24/7 availability.")}
          </p>
        </div>
        <div className="flex gap-5 border-b border-line">
          {(["catalog", "settings"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`relative px-0.5 pb-2.5 pt-1 text-[13px] transition-colors ${
                tab === item
                  ? "font-semibold text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-brand"
                  : "text-muted hover:text-ink"
              }`}
            >
              {item === "catalog" ? t("Catalog & stock") : t("Settings")}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 border-t border-line lg:grid-cols-4">
        {[
          { label: t("SKUs"), value: stats.count },
          { label: t("Low stock"), value: stats.low },
          { label: t("Out of stock"), value: stats.out },
          { label: t("Inventory value"), value: money(stats.value) },
        ].map((item, index) => (
          <div
            key={item.label}
            className={`py-4 ${
              index % 2 === 1 ? "border-s border-line ps-4" : ""
            } ${index > 1 ? "border-t border-line lg:border-t-0" : ""} ${
              index > 1 ? "lg:border-s lg:border-line lg:ps-5" : ""
            } lg:ps-5 lg:[&:nth-child(1)]:ps-0`}
          >
            <div className="text-[11px] text-muted">{item.label}</div>
            <div className="mt-1.5 font-display text-[24px] font-semibold leading-none tracking-[-0.03em] tnum">
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {toast ? (
        <div className="fixed bottom-6 start-1/2 z-50 -translate-x-1/2 rounded-[6px] bg-ink px-4 py-2.5 text-[12px] font-medium text-on-dark shadow-[var(--shadow-float)] rtl:translate-x-1/2">
          {toast}
        </div>
      ) : null}

      {tab === "catalog" ? (
        <section className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <label className="inline-flex min-h-9 items-center gap-2 rounded-[6px] border border-line bg-surface px-3 py-2 text-[12px] font-medium text-muted">
                <input
                  type="checkbox"
                  checked={lowOnly}
                  onChange={(event) => setLowOnly(event.target.checked)}
                  className="h-4 w-4 accent-[var(--brand)]"
                />
                {t("Low stock only")}
              </label>
              <span className="pill">{visible.length} {t("products")}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setError("");
                setEditingId(null);
                setProductDraft(draftFrom());
              }}
              className="btn btn-primary btn-sm"
            >
              <Plus size={14} /> {t("Add product")}
            </button>
          </div>

          <div className="card mt-3 overflow-hidden">
            <div className="divide-y divide-line">
              {visible.map((product) => {
                const stock =
                  product.variants?.length
                    ? product.variants.reduce((sum, variant) => sum + variant.stock, 0)
                    : product.stock;
                const badge = stockBadge(stock, product.lowStockThreshold ?? settings.lowStockThreshold);
                return (
                  <div key={product.id} className="flex flex-wrap items-center gap-3 p-3">
                    <div className="min-w-0 flex-1 basis-full sm:basis-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-[13px] font-semibold">{product.name}</span>
                        {product.variants?.length ? (
                          <span className="pill">{product.variants.length} {t("variants")}</span>
                        ) : null}
                        {product.popular ? <span className="pill pill-warm">{t("Popular")}</span> : null}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
                        <span>{product.category}</span>
                        <span>{product.sku || t("No SKU")}</span>
                        <span>{product.unit || t("each")}</span>
                        <span className="tnum">{money(product.price)}</span>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 px-1.5 py-0.5 text-[11px] font-medium ${
                        badge.tone === "out"
                          ? "text-danger"
                          : badge.tone === "low"
                            ? "text-signal"
                            : "text-muted"
                      }`}
                    >
                      {badge.tone === "low"
                        ? t("Only {count} left", { count: stock ?? 0 })
                        : badge.tone === "out"
                          ? t("Sold out")
                          : t("In stock")}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      {product.variants?.length ? null : (
                        <>
                          <button
                            type="button"
                            onClick={() => adjustStock(product, -1)}
                            className="grid h-9 w-9 place-items-center rounded-[4px] border border-line transition-colors hover:border-line-strong hover:bg-surface-2"
                            aria-label={t("Decrease stock")}
                          >
                            −
                          </button>
                          <span className="w-7 text-center text-[12px] font-semibold tnum">
                            {stock ?? "∞"}
                          </span>
                          <button
                            type="button"
                            onClick={() => adjustStock(product, 1)}
                            className="grid h-9 w-9 place-items-center rounded-[4px] border border-line transition-colors hover:border-line-strong hover:bg-surface-2"
                            aria-label={t("Increase stock")}
                          >
                            +
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setError("");
                          setEditingId(product.id);
                          setProductDraft(draftFrom(product));
                        }}
                        className="btn btn-ghost btn-sm"
                      >
                        <Pencil size={12} /> {t("Edit")}
                      </button>
                    </div>
                  </div>
                );
              })}
              {!visible.length ? (
                <div className="px-6 py-10 text-center text-sm font-bold text-muted">
                  {t("No products match this filter.")}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : (
        <section className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="card p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Truck size={15} className="text-brand" /> {t("Fulfilment")}
            </h2>
            <div className="mt-4 space-y-3">
              {[
                { key: "expressEnabled" as const, label: t("Express delivery") },
                { key: "pickupEnabled" as const, label: t("Store pickup") },
                { key: "schedulingEnabled" as const, label: t("Scheduled windows") },
                { key: "alwaysOpen" as const, label: t("Always open (24/7 ordering)") },
                { key: "overnightStaffed" as const, label: t("Overnight staffed") },
              ].map((row) => (
                <label key={row.key} className="flex items-center justify-between gap-3 rounded-[6px] bg-surface-2 p-3">
                  <span className="text-xs font-semibold">{row.label}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(settings[row.key])}
                    onChange={(event) => updateSetting(row.key, event.target.checked)}
                    className="h-4 w-4 accent-[var(--brand)]"
                  />
                </label>
              ))}
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="label">{t("Express fee")}</span>
                  <input
                    className="input"
                    type="number"
                    value={settings.expressFee}
                    onChange={(event) => updateSetting("expressFee", Number(event.target.value))}
                  />
                </label>
                <label className="block">
                  <span className="label">{t("Express minutes")}</span>
                  <input
                    className="input"
                    type="number"
                    value={settings.expressMinutes}
                    onChange={(event) => updateSetting("expressMinutes", Number(event.target.value))}
                  />
                </label>
                <label className="block">
                  <span className="label">{t("Night start")}</span>
                  <input
                    className="input"
                    value={settings.nightStart}
                    onChange={(event) => updateSetting("nightStart", event.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="label">{t("Night end")}</span>
                  <input
                    className="input"
                    value={settings.nightEnd}
                    onChange={(event) => updateSetting("nightEnd", event.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="label">{t("Night fee")}</span>
                  <input
                    className="input"
                    type="number"
                    value={settings.nightFee}
                    onChange={(event) => updateSetting("nightFee", Number(event.target.value))}
                  />
                </label>
                <label className="block">
                  <span className="label">{t("Low-stock threshold")}</span>
                  <input
                    className="input"
                    type="number"
                    value={settings.lowStockThreshold}
                    onChange={(event) => updateSetting("lowStockThreshold", Number(event.target.value))}
                  />
                </label>
              </div>
              <label className="block">
                <span className="label">{t("Scheduled slots (comma separated)")}</span>
                <input
                  className="input"
                  value={settings.scheduleSlots.join(", ")}
                  onChange={(event) =>
                    updateSetting(
                      "scheduleSlots",
                      event.target.value.split(",").map((slot) => slot.trim()).filter(Boolean),
                    )
                  }
                />
              </label>
              <label className="block">
                <span className="label">{t("Default substitution")}</span>
                <select
                  className="input"
                  value={settings.substitutionDefault}
                  onChange={(event) =>
                    updateSetting(
                      "substitutionDefault",
                      event.target.value as GrocerySettings["substitutionDefault"],
                    )
                  }
                >
                  <option value="allow">{t("Allow a similar item")}</option>
                  <option value="contact">{t("Call me first")}</option>
                  <option value="refund">{t("Remove & refund")}</option>
                </select>
              </label>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Settings2 size={15} className="text-brand" /> {t("Delivery zones")}
              </h2>
              <button
                type="button"
                onClick={() =>
                  setSettings((current) => ({
                    ...current,
                    deliveryZones: [
                      ...current.deliveryZones,
                      { id: `zone-${current.deliveryZones.length + 1}`, name: t("New zone"), maxKm: 10, fee: 10, minOrder: 30 },
                    ],
                  }))
                }
                className="btn btn-ghost btn-sm"
              >
                <Plus size={12} /> {t("Add zone")}
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {settings.deliveryZones.map((zone, index) => (
                <div key={zone.id} className="grid grid-cols-2 gap-2 rounded-[6px] bg-surface-2 p-3 sm:grid-cols-4">
                  <label className="col-span-2 block sm:col-span-4">
                    <span className="label">{t("Zone name")}</span>
                    <input
                      className="input"
                      value={zone.name}
                      onChange={(event) => updateZone(index, { name: event.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="label">{t("Max km")}</span>
                    <input
                      className="input"
                      type="number"
                      step="0.5"
                      value={zone.maxKm}
                      onChange={(event) => updateZone(index, { maxKm: Number(event.target.value) })}
                    />
                  </label>
                  <label className="block">
                    <span className="label">{t("Fee")}</span>
                    <input
                      className="input"
                      type="number"
                      value={zone.fee}
                      onChange={(event) => updateZone(index, { fee: Number(event.target.value) })}
                    />
                  </label>
                  <label className="block">
                    <span className="label">{t("Min order")}</span>
                    <input
                      className="input"
                      type="number"
                      value={zone.minOrder}
                      onChange={(event) => updateZone(index, { minOrder: Number(event.target.value) })}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setSettings((current) => ({
                        ...current,
                        deliveryZones: current.deliveryZones.filter((_, i) => i !== index),
                      }))
                    }
                    className="mt-5 grid h-9 place-items-center rounded-[6px] text-danger hover:bg-danger-soft"
                    aria-label={t("Remove zone")}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={saveSettings}
              disabled={saving}
              className="btn btn-primary mt-4 w-full"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {t("Save grocery settings")}
            </button>
            {error ? <p className="mt-2 text-xs font-bold text-danger">{error}</p> : null}
          </div>
        </section>
      )}

      {productDraft ? (
        <ProductModal
          storeName={store.name}
          draft={productDraft}
          editing={Boolean(editingId)}
          saving={saving}
          error={error}
          onChange={(draft) => setProductDraft(draft)}
          onClose={() => {
            setProductDraft(null);
            setEditingId(null);
          }}
          onSave={saveProduct}
        />
      ) : null}
    </div>
  );
}

function ProductModal({
  storeName,
  draft,
  editing,
  saving,
  error,
  onChange,
  onClose,
  onSave,
}: {
  storeName: string;
  draft: ProductDraft;
  editing: boolean;
  saving: boolean;
  error: string;
  onChange: (draft: ProductDraft) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const { t } = useI18n();
  function set<K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) {
    onChange({ ...draft, [key]: value });
  }
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-[10px] bg-surface p-5 shadow-[var(--shadow-float)] sm:rounded-[10px]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-[22px] font-semibold tracking-[-0.025em]">
              {editing ? t("Edit product") : t("Add product")}
            </h2>
            <p className="mt-0.5 text-[11px] text-muted">{storeName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-[6px] bg-surface-2 text-muted transition-colors hover:text-ink"
            aria-label={t("Close")}
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="label">{t("Name")}</span>
            <input className="input" value={draft.name} onChange={(event) => set("name", event.target.value)} />
          </label>
          <label className="block">
            <span className="label">{t("Department")}</span>
            <input className="input" value={draft.category} onChange={(event) => set("category", event.target.value)} />
          </label>
          <label className="block">
            <span className="label">{t("Aisle")}</span>
            <input className="input" value={draft.aisle} onChange={(event) => set("aisle", event.target.value)} />
          </label>
          <label className="block">
            <span className="label">{t("Price (MAD)")}</span>
            <input className="input" type="number" value={draft.price} onChange={(event) => set("price", event.target.value)} />
          </label>
          <label className="block">
            <span className="label">{t("Unit")}</span>
            <input className="input" value={draft.unit} onChange={(event) => set("unit", event.target.value)} />
          </label>
          <label className="block">
            <span className="label">{t("SKU")}</span>
            <input className="input" value={draft.sku} onChange={(event) => set("sku", event.target.value)} />
          </label>
          <label className="block">
            <span className="label">{t("Barcode")}</span>
            <input className="input" value={draft.barcode} onChange={(event) => set("barcode", event.target.value)} />
          </label>
          <label className="block">
            <span className="label">{t("Brand")}</span>
            <input className="input" value={draft.brand} onChange={(event) => set("brand", event.target.value)} />
          </label>
          <label className="block">
            <span className="label">{t("Stock")}</span>
            <input className="input" type="number" value={draft.stock} onChange={(event) => set("stock", event.target.value)} />
          </label>
          <label className="block">
            <span className="label">{t("Low-stock threshold")}</span>
            <input
              className="input"
              type="number"
              value={draft.lowStockThreshold}
              onChange={(event) => set("lowStockThreshold", event.target.value)}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="label">{t("Description")}</span>
            <textarea
              className="input min-h-[70px]"
              value={draft.description}
              onChange={(event) => set("description", event.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 rounded-[6px] bg-surface-2 p-3">
            <input
              type="checkbox"
              checked={draft.available}
              onChange={(event) => set("available", event.target.checked)}
              className="h-4 w-4 accent-[var(--brand)]"
            />
            <span className="text-xs font-semibold">{t("Available")}</span>
          </label>
          <label className="flex items-center gap-2 rounded-[6px] bg-surface-2 p-3">
            <input
              type="checkbox"
              checked={draft.popular}
              onChange={(event) => set("popular", event.target.checked)}
              className="h-4 w-4 accent-[var(--brand)]"
            />
            <span className="text-xs font-semibold">{t("Popular")}</span>
          </label>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <span className="label">{t("Variants")}</span>
            <button
              type="button"
              onClick={() =>
                set("variants", [
                  ...draft.variants,
                  {
                    id: `v${draft.variants.length + 1}-${Date.now().toString(36)}`,
                    label: "",
                    sku: "",
                    price: Number(draft.price) || 1,
                    stock: 0,
                    unit: draft.unit,
                  },
                ])
              }
              className="btn btn-ghost btn-sm"
            >
              <Plus size={12} /> {t("Add variant")}
            </button>
          </div>
          <div className="mt-2 space-y-2">
            {draft.variants.map((variant, index) => (
              <div key={variant.id} className="grid grid-cols-2 gap-2 rounded-[6px] bg-surface-2 p-3 sm:grid-cols-5">
                <input
                  className="input"
                  placeholder={t("Label")}
                  value={variant.label}
                  onChange={(event) => {
                    const next = [...draft.variants];
                    next[index] = { ...variant, label: event.target.value };
                    set("variants", next);
                  }}
                />
                <input
                  className="input"
                  placeholder={t("SKU")}
                  value={variant.sku}
                  onChange={(event) => {
                    const next = [...draft.variants];
                    next[index] = { ...variant, sku: event.target.value };
                    set("variants", next);
                  }}
                />
                <input
                  className="input"
                  type="number"
                  placeholder={t("Price")}
                  value={variant.price}
                  onChange={(event) => {
                    const next = [...draft.variants];
                    next[index] = { ...variant, price: Number(event.target.value) };
                    set("variants", next);
                  }}
                />
                <input
                  className="input"
                  type="number"
                  placeholder={t("Stock")}
                  value={variant.stock}
                  onChange={(event) => {
                    const next = [...draft.variants];
                    next[index] = { ...variant, stock: Number(event.target.value) };
                    set("variants", next);
                  }}
                />
                <button
                  type="button"
                  onClick={() =>
                    set("variants", draft.variants.filter((_, i) => i !== index))
                  }
                  className="grid h-9 place-items-center rounded-[6px] text-danger hover:bg-danger-soft"
                  aria-label={t("Remove variant")}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {error ? <p className="mt-3 text-xs font-bold text-danger">{error}</p> : null}
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost flex-1">
            {t("Cancel")}
          </button>
          <button type="button" onClick={onSave} disabled={saving} className="btn btn-primary flex-1">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {editing ? t("Save product") : t("Add product")}
          </button>
        </div>
      </div>
    </div>
  );
}
