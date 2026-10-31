"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ImagePlus,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import type { Product, Store } from "@/lib/types";
import { money } from "@/lib/utils";
import { resizeImage } from "@/lib/image-client";

export function AdminMenuModal({
  store,
  onClose,
}: {
  store: Store;
  onClose: () => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    category: store.category === "grocery" ? "Fresh" : "Mains",
    price: "",
    unit: store.category === "grocery" ? "each" : "",
    stock: store.category === "grocery" ? "20" : "",
    description: "",
    image: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch(`/api/products?storeId=${store.id}`, {
      cache: "no-store",
    });
    const data = (await response.json()) as { products?: Product[]; error?: string };
    if (response.ok && data.products) setProducts(data.products);
    else setError(data.error || "Could not load the menu");
    setLoading(false);
  }, [store.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setBusy("new");
    setError("");
    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: store.id,
          name: draft.name,
          category: draft.category,
          price: Number(draft.price),
          unit: draft.unit || undefined,
          stock: draft.stock ? Number(draft.stock) : undefined,
          description: draft.description,
          image: draft.image || undefined,
          available: true,
        }),
      });
      const data = (await response.json()) as { product?: Product; error?: string };
      if (!response.ok || !data.product) {
        setError(data.error || "Could not add the item");
        return;
      }
      setProducts((current) => [...current, data.product as Product]);
      setDraft((current) => ({
        ...current,
        name: "",
        price: "",
        description: "",
        stock: current.stock,
      }));
      setOpen(false);
    } finally {
      setBusy("");
    }
  }

  async function toggle(product: Product) {
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

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-ink/55 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Menu for ${store.name}`}
        className="my-6 w-full max-w-2xl rounded-[12px] bg-surface p-5 shadow-[var(--shadow-float)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="eyebrow">{store.citySlug} · {store.category}</div>
            <h2 className="mt-1 font-display text-[24px] font-semibold tracking-[-0.03em]">
              {store.name} menu
            </h2>
            <p className="mt-1 text-[11px] text-muted">
              Add an item on the merchant's behalf. It appears on their storefront
              immediately.
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void load()}
              className="grid h-9 w-9 place-items-center rounded-[6px] text-muted hover:bg-surface-2 hover:text-ink"
              aria-label="Refresh menu"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-[6px] text-muted hover:bg-surface-2 hover:text-ink"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="pill">{products.length} items</span>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="btn btn-primary btn-sm"
          >
            <Plus size={13} /> Add item
          </button>
        </div>

        {open ? (
          <form
            onSubmit={add}
            className="mt-3 grid gap-2 rounded-[8px] border border-line bg-surface-2/50 p-3 sm:grid-cols-2"
          >
            <label className="block sm:col-span-2">
              <span className="label">Item name</span>
              <input
                className="input"
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Chicken tagine"
                required
              />
            </label>
            <label className="block">
              <span className="label">Category</span>
              <input
                className="input"
                value={draft.category}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, category: event.target.value }))
                }
                required
              />
            </label>
            <label className="block">
              <span className="label">Price (MAD)</span>
              <input
                className="input"
                type="number"
                min={1}
                value={draft.price}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, price: event.target.value }))
                }
                required
              />
            </label>
            <label className="block">
              <span className="label">Unit</span>
              <input
                className="input"
                value={draft.unit}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, unit: event.target.value }))
                }
                placeholder="1kg / each"
              />
            </label>
            <label className="block">
              <span className="label">Stock</span>
              <input
                className="input"
                type="number"
                min={0}
                value={draft.stock}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, stock: event.target.value }))
                }
                placeholder="Optional"
              />
            </label>
            <div className="flex items-center gap-3 rounded-[6px] border border-line p-2 sm:col-span-2">
              {draft.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.image} alt="Item preview" className="h-12 w-12 rounded-[4px] object-cover" />
              ) : (
                <span className="grid h-12 w-12 place-items-center rounded-[4px] bg-surface-2 text-muted">
                  <ImagePlus size={17} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold">Item photo</div>
                <div className="text-[10px] text-muted">Optional menu image.</div>
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
                      width: 640,
                      height: 640,
                      fit: "cover",
                    });
                    setDraft((current) => ({ ...current, image }));
                  }}
                />
              </label>
            </div>
            <label className="block sm:col-span-2">
              <span className="label">Description</span>
              <textarea
                className="input min-h-[64px]"
                value={draft.description}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="Short description"
              />
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost flex-1">
                Cancel
              </button>
              <button type="submit" disabled={busy === "new"} className="btn btn-primary flex-1">
                {busy === "new" ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Add item
              </button>
            </div>
          </form>
        ) : null}

        {error ? (
          <p className="mt-3 rounded-[6px] bg-danger-soft px-3 py-2 text-[11px] font-medium text-danger">
            {error}
          </p>
        ) : null}

        <div className="mt-4 max-h-[45vh] divide-y divide-line overflow-y-auto rounded-[8px] border border-line">
          {loading ? (
            <div className="grid place-items-center py-10">
              <Loader2 size={20} className="animate-spin text-muted" />
            </div>
          ) : products.length ? (
            products.map((product) => (
              <div key={product.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-[4px] bg-surface-2 text-muted">
                  {product.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Package size={14} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-semibold">{product.name}</div>
                  <div className="text-[10px] text-muted">
                    {product.category}
                    {product.stock !== undefined ? ` · ${product.stock} in stock` : ""}
                  </div>
                </div>
                <span className="text-[12px] font-semibold tnum">{money(product.price)}</span>
                <button
                  type="button"
                  onClick={() => void toggle(product)}
                  disabled={busy === product.id}
                  className={`rounded-[2px] px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                    product.available
                      ? "bg-success-soft text-success"
                      : "bg-danger-soft text-danger"
                  }`}
                >
                  {product.available ? "Live" : "Off"}
                </button>
              </div>
            ))
          ) : (
            <div className="px-4 py-10 text-center text-[12px] text-muted">
              No items yet. Add the first one above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
