"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Heart, ShoppingBasket } from "lucide-react";
import type { Product } from "@/lib/types";
import { useI18n } from "@/components/locale-provider";
import { ProductTile } from "@/components/product-icon";
import { money } from "@/lib/utils";

export function FavoritesView({
  items,
}: {
  items: { product: Product; storeName: string; storeSlug: string }[];
}) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(items);

  async function remove(productId: string) {
    setVisible((current) => current.filter((item) => item.product.id !== productId));
    await fetch("/api/grocery/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    }).catch(() => undefined);
  }

  if (!visible.length) {
    return (
      <div className="card mt-6 grid place-items-center px-6 py-16 text-center">
        <Heart size={26} className="text-coral" />
        <h2 className="mt-3 text-xl font-extrabold">{t("No favourites yet")}</h2>
        <p className="mt-1 text-sm text-ink/45">
          {t("Tap the heart on a grocery product to save it here.")}
        </p>
        <Link href="/grocery" className="btn btn-primary mt-5">
          {t("Browse groceries")} <ArrowRight size={14} className="rtl:-scale-x-100" />
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {visible.map(({ product, storeName, storeSlug }) => (
        <div key={product.id} className="card-flat flex gap-3 p-3">
          <ProductTile
            name={product.name}
            category={product.category}
            className="h-16 w-16 rounded-2xl"
            iconSize={26}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-extrabold">{product.name}</div>
            <div className="text-[10px] font-bold text-ink/40">
              {storeName} · {product.unit || "each"}
            </div>
            <div className="mt-1 text-sm font-extrabold">{money(product.price)}</div>
            <div className="mt-1 flex items-center gap-2">
              <Link href={`/grocery/${storeSlug}`} className="text-[10px] font-extrabold text-teal">
                {t("Open store")} <ArrowRight size={10} className="inline rtl:-scale-x-100" />
              </Link>
              <button
                type="button"
                onClick={() => remove(product.id)}
                className="ms-auto grid h-8 w-8 place-items-center rounded-lg text-coral hover:bg-red-50"
                aria-label={t("Remove from favourites")}
              >
                <Heart size={14} className="fill-coral" />
              </button>
            </div>
          </div>
        </div>
      ))}
      <Link href="/grocery" className="card-flat grid place-items-center p-4 text-center">
        <ShoppingBasket size={20} className="text-teal" />
        <span className="mt-1 text-[11px] font-extrabold">{t("Keep shopping")}</span>
      </Link>
    </div>
  );
}
