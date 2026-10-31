"use client";

import Link from "next/link";
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import { ProductTile } from "@/components/product-icon";
import { money } from "@/lib/utils";
import { useI18n } from "@/components/locale-provider";

export function CartView() {
  const {
    items,
    ready,
    subtotal,
    deliveryFee,
    minOrder,
    setQty,
    removeItem,
    clear,
    storeName,
    storeSlug,
    storeCategory,
  } = useCart();
  const { t } = useI18n();

  if (!ready) {
    return <div className="mt-8 h-48 animate-pulse rounded-[10px] bg-surface-2" />;
  }

  if (!items.length) {
    return (
      <div className="mt-8 border-y border-line py-20 text-center">
        <ShoppingBag size={22} className="mx-auto text-muted" />
        <h2 className="mt-4 font-display text-2xl font-semibold tracking-[-0.03em]">
          {t("Your cart is empty")}
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-6 text-muted">
          {t("Browse local stores in Dakhla or Laayoune and add something you love.")}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/city/dakhla" className="btn btn-primary">
            {t("Browse {city}", { city: "Dakhla" })}
            <ArrowRight size={14} className="rtl:-scale-x-100" />
          </Link>
          <Link href="/grocery" className="btn btn-ghost">
            {t("Shop groceries")}
          </Link>
        </div>
      </div>
    );
  }

  const fee = deliveryFee || 0;
  const minimum = minOrder || 0;
  const total = subtotal + fee;
  const belowMinimum = subtotal < minimum;

  return (
    <div className="mt-8 grid gap-6 pb-16 lg:grid-cols-[1fr_340px] lg:items-start">
      <div className="rounded-[10px] border border-line bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <div className="text-[11px] text-muted">{t("Ordering from")}</div>
            <Link
              href={`/store/${storeSlug}`}
              className="text-[15px] font-semibold hover:underline"
            >
              {storeName}
            </Link>
            <span className="ms-2 text-[11px] text-muted">
              {storeCategory === "grocery" ? t("Supermarket") : t("Restaurant")}
            </span>
          </div>
          <button type="button" onClick={clear} className="btn btn-ghost btn-sm">
            <Trash2 size={12} /> {t("Clear")}
          </button>
        </div>

        <div className="divide-y divide-line">
          {items.map((item) => (
            <div key={item.lineId} className="flex items-center gap-3 px-4 py-3.5">
              <ProductTile
                name={item.name}
                className="h-[52px] w-[52px] rounded-[6px]"
                iconSize={20}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold">{item.name}</div>
                <div className="mt-0.5 line-clamp-1 text-[11px] text-muted">
                  {[
                    item.variantLabel || item.unit,
                    ...item.options
                      .filter((option) => option.groupId !== "__variant")
                      .map((option) => option.optionName),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                <div className="mt-0.5 text-[11px] text-muted tnum">
                  {money(item.price)} {t("each")}
                </div>
              </div>

              <div className="flex items-center rounded-[4px] border border-line">
                <button
                  type="button"
                  onClick={() => setQty(item.lineId, item.qty - 1)}
                  className="grid h-8 w-8 place-items-center text-muted hover:bg-surface-2 hover:text-ink"
                  aria-label={t("Decrease quantity")}
                >
                  <Minus size={13} />
                </button>
                <span className="w-7 text-center text-[12px] font-semibold tnum">
                  {item.qty}
                </span>
                <button
                  type="button"
                  onClick={() => setQty(item.lineId, item.qty + 1)}
                  className="grid h-8 w-8 place-items-center text-muted hover:bg-surface-2 hover:text-ink"
                  aria-label={t("Increase quantity")}
                >
                  <Plus size={13} />
                </button>
              </div>

              <div className="hidden w-20 text-end text-[13px] font-semibold tnum sm:block">
                {money(item.price * item.qty)}
              </div>

              <button
                type="button"
                onClick={() => removeItem(item.lineId)}
                className="grid h-8 w-8 place-items-center text-muted transition-colors hover:text-danger"
                aria-label={t("Remove item")}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-line px-5 py-3">
          <Link
            href={`/store/${storeSlug}`}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-brand"
          >
            <Plus size={13} /> {t("Add more items")}
          </Link>
          <span className="text-[11px] text-muted tnum">
            {items.reduce((sum, item) => sum + item.qty, 0)} {t("items")}
          </span>
        </div>
      </div>

      <aside className="rounded-[10px] border border-line bg-surface p-5 lg:sticky lg:top-24">
        <h2 className="font-display text-[20px] font-semibold tracking-[-0.02em]">
          {t("Summary")}
        </h2>
        <div className="mt-4 space-y-2 text-[12px]">
          <div className="flex justify-between text-muted">
            <span>{t("Subtotal")}</span>
            <span className="font-medium text-ink tnum">{money(subtotal)}</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>{t("Delivery fee")}</span>
            <span className="font-medium text-ink tnum">{money(fee)}</span>
          </div>
          <div className="flex justify-between border-t border-line pt-3 text-[15px] font-semibold">
            <span>{t("Total")}</span>
            <span className="tnum">{money(total)}</span>
          </div>
        </div>

        <div className="mt-4 border-s-2 border-signal ps-3">
          <div className="text-[12px] font-medium">{t("Cash on delivery")}</div>
          <p className="mt-0.5 text-[11px] leading-5 text-muted">
            {storeCategory === "grocery"
              ? t("Delivery, night and express fees are confirmed at checkout.")
              : t("Keep {amount} ready. The driver confirms the amount on delivery.", {
                  amount: money(total),
                })}
          </p>
        </div>

        {belowMinimum ? (
          <p className="mt-3 text-[11px] font-medium text-danger">
            {t("Add {amount} more to meet the {minimum} minimum.", {
              amount: money(minimum - subtotal),
              minimum: money(minimum),
            })}
          </p>
        ) : null}

        <Link
          href="/checkout"
          className={`btn mt-4 w-full ${
            belowMinimum ? "pointer-events-none opacity-40" : "btn-primary"
          }`}
          aria-disabled={belowMinimum}
        >
          {t("Continue to delivery")}
          <ArrowRight size={15} className="rtl:-scale-x-100" />
        </Link>
        <p className="mt-3 text-center text-[10px] text-muted">
          {t("No account needed · Pay cash on arrival")}
        </p>
      </aside>
    </div>
  );
}
