"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Banknote, Boxes, Check, Loader2, PackagePlus, RotateCcw, X } from "lucide-react";
import type { Product, RefundRequest } from "@/lib/types";
import { stockBadge } from "@/lib/grocery";
import { useI18n } from "@/components/locale-provider";
import { money, timeAgo } from "@/lib/utils";

export function GroceryAdmin({
  stores,
  initialProducts,
  initialRefunds,
}: {
  stores: { id: string; name: string; citySlug: string }[];
  initialProducts: Product[];
  initialRefunds: RefundRequest[];
}) {
  const { t } = useI18n();
  const [products, setProducts] = useState(initialProducts);
  const [refunds, setRefunds] = useState(initialRefunds);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: t("SKUs"), value: products.length, icon: Boxes, tone: "bg-teal/10 text-teal" },
          { label: t("Low stock"), value: stats.low, icon: AlertTriangle, tone: "bg-saffron/20 text-saffron-deep" },
          { label: t("Out of stock"), value: stats.out, icon: PackagePlus, tone: "bg-red-50 text-red-500" },
          { label: t("Inventory value"), value: money(stats.value), icon: Banknote, tone: "bg-ink/5 text-ink" },
        ].map((item) => (
          <div key={item.label} className="card-flat p-4">
            <span className={`grid h-9 w-9 place-items-center rounded-xl ${item.tone}`}>
              <item.icon size={16} />
            </span>
            <div className="mt-3 text-xl font-extrabold">{item.value}</div>
            <div className="text-[9px] font-extrabold uppercase tracking-wider text-ink/35">{item.label}</div>
          </div>
        ))}
      </div>

      {message ? <div className="rounded-xl bg-teal/10 px-3 py-2 text-xs font-bold text-teal">{message}</div> : null}

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold">{t("Low stock & restock")}</h2>
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
                    <div className="truncate text-[13px] font-extrabold">{product.name}</div>
                    <div className="text-[10px] font-bold text-ink/40">
                      {storeName.get(product.storeId)} · {product.sku || t("No SKU")} · {money(product.price)}
                    </div>
                  </div>
                  <span className="rounded-full bg-saffron/20 px-2 py-1 text-[9px] font-extrabold uppercase text-saffron-deep">
                    {badge.tone === "low"
                              ? t("Only {count} left", { count: stock ?? 0 })
                              : badge.tone === "out"
                                ? t("Sold out")
                                : t("In stock")}
                  </span>
                  {product.variants?.length ? (
                    <span className="text-[10px] font-bold text-ink/35">
                      {product.variants.length} {t("variants")}
                    </span>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => adjust(product, -1)}
                        disabled={busy === product.id}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-ink/10"
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
              <div className="px-6 py-8 text-center text-sm font-bold text-ink/40">
                {t("Everything is above the low-stock threshold.")}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold">{t("Refund requests")}</h2>
          <span className="pill">
            {refunds.filter((refund) => refund.status === "pending").length} {t("pending")}
          </span>
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {refunds.map((refund) => (
            <div key={refund.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[13px] font-extrabold">{refund.orderId}</div>
                  <div className="text-[10px] font-bold text-ink/35">
                    {timeAgo(refund.createdAt)} · {refund.lines.length} {t("lines")}
                  </div>
                </div>
                <span className="pill">{t(refund.status)}</span>
              </div>
              <p className="mt-2 text-xs text-ink/55">{refund.reason}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm font-extrabold">{money(refund.amount)}</span>
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
            <div className="card grid place-items-center px-6 py-10 text-center text-sm font-bold text-ink/40 lg:col-span-2">
              {t("No refund requests yet.")}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
