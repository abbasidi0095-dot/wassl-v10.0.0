"use client";

import Link from "next/link";
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import { ProductTile } from "@/components/product-icon";
import { money } from "@/lib/utils";
import { useI18n } from "@/components/locale-provider";

export function CartView() {
  const { items, ready, subtotal, deliveryFee, minOrder, setQty, removeItem, clear, storeName, storeSlug, storeCategory } =
    useCart();
  const { t } = useI18n();

  if (!ready) {
    return <div className="card mt-8 h-48 animate-pulse" />;
  }

  if (!items.length) {
    return (
      <div className="card mt-8 grid place-items-center px-6 py-16 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-teal/10 text-teal">
          <ShoppingBag size={26} />
        </span>
        <h2 className="mt-4 text-2xl font-extrabold tracking-tight">{t("Your cart is empty")}</h2>
        <p className="mt-2 max-w-sm text-sm leading-6 text-ink/50">
          {t("Browse local stores in Dakhla or Laayoune and add something you love.")}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/city/dakhla" className="btn btn-primary">
            {t("Browse {city}", { city: "Dakhla" })} <ArrowRight size={14} className="rtl:-scale-x-100" />
          </Link>
          <Link href="/cities" className="btn btn-ghost">
            {t("All cities")}
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
    <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_360px] lg:items-start">
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-ink/8 px-5 py-4">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink/35">
              {t("Ordering from")}
            </div>
            <Link href={`/store/${storeSlug}`} className="text-sm font-extrabold text-teal">
              {storeName}
            </Link>
          </div>
          <button type="button" onClick={clear} className="btn btn-ghost btn-sm">
            <Trash2 size={13} /> {t("Clear")}
          </button>
        </div>
        <div className="divide-y divide-ink/6">
          {items.map((item) => (
            <div key={item.lineId} className="flex items-center gap-3 p-4">
              <ProductTile
                name={item.name}
                className="h-14 w-14 rounded-2xl"
                iconSize={24}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-extrabold">{item.name}</div>
                {item.options.length ? (
                  <div className="mt-0.5 line-clamp-2 text-[10px] font-bold text-ink/40">
                    {[item.variantLabel || item.unit, ...item.options.filter((option) => option.groupId !== "__variant").map((option) => option.optionName)]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                ) : null}
                <div className="mt-0.5 text-[11px] font-bold text-ink/40">
                  {money(item.price)} each
                </div>
              </div>
              <div className="flex items-center gap-1 rounded-xl border border-ink/10 bg-white p-1">
                <button
                  type="button"
                  onClick={() => setQty(item.lineId, item.qty - 1)}
                  className="grid h-7 w-7 place-items-center rounded-lg hover:bg-cream"
                  aria-label={t("Decrease quantity")}
                >
                  <Minus size={13} />
                </button>
                <span className="w-5 text-center text-xs font-extrabold">{item.qty}</span>
                <button
                  type="button"
                  onClick={() => setQty(item.lineId, item.qty + 1)}
                  className="grid h-7 w-7 place-items-center rounded-lg hover:bg-cream"
                  aria-label={t("Increase quantity")}
                >
                  <Plus size={13} />
                </button>
              </div>
              <div className="w-20 text-end text-[13px] font-extrabold">
                {money(item.price * item.qty)}
              </div>
              <button
                type="button"
                onClick={() => removeItem(item.lineId)}
                className="grid h-8 w-8 place-items-center rounded-lg text-ink/25 hover:bg-red-50 hover:text-red-500"
                aria-label={t("Remove item")}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <div className="bg-cream/60 px-5 py-3">
          <Link
            href={`/store/${storeSlug}`}
            className="inline-flex items-center gap-1 text-[11px] font-extrabold text-teal"
          >
            <Plus size={13} /> {t("Add more items")}
          </Link>
        </div>
      </div>

      <aside className="card p-5 lg:sticky lg:top-24">
        <h2 className="text-lg font-extrabold tracking-tight">{t("Order summary")}</h2>
        <div className="mt-4 space-y-2 text-[12px]">
          <div className="flex justify-between text-ink/50">
            <span>{t("Subtotal")}</span>
            <span className="font-extrabold text-ink">{money(subtotal)}</span>
          </div>
          <div className="flex justify-between text-ink/50">
            <span>{t("Delivery fee")}</span>
            <span className="font-extrabold text-ink">{money(fee)}</span>
          </div>
          <div className="flex justify-between border-t border-ink/8 pt-3 text-base font-extrabold">
            <span>{t("Total")}</span>
            <span>{money(total)}</span>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-saffron/15 p-3">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-ink/55">
            {t("Cash on delivery")}
          </div>
          <p className="mt-1 text-[11px] leading-5 text-ink/50">
            {t("Keep {amount} ready. The driver confirms the amount on delivery.", { amount: money(total) })}
          </p>
        </div>

        {belowMinimum ? (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700">
            {t("Add {amount} more to meet the {minimum} minimum.", { amount: money(minimum - subtotal), minimum: money(minimum) })}
          </p>
        ) : null}

        <Link
          href="/checkout"
          className={`btn mt-4 w-full ${belowMinimum ? "pointer-events-none opacity-40" : "btn-primary"}`}
          aria-disabled={belowMinimum}
        >
          {t("Continue to delivery")} <ArrowRight size={15} className="rtl:-scale-x-100" />
        </Link>
        <p className="mt-3 text-center text-[9px] font-bold text-ink/30">
          {t("No account needed · Pay cash on arrival")}
        </p>
      </aside>
    </div>
  );
}
