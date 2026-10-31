"use client";

import { useMemo, useState } from "react";
import { Lock, Plus, Search, Sparkles } from "lucide-react";
import type { Product, Store } from "@/lib/types";
import { money } from "@/lib/utils";
import { tapFeedback } from "@/lib/haptics";
import { useCart } from "./cart-provider";
import { ProductSheet } from "./product-sheet";
import { ProductTile } from "./product-icon";
import { useI18n } from "./locale-provider";
import { useLiveActivity } from "./live-activity-provider";

export function StoreMenu({
  store,
  products,
}: {
  store: Store;
  products: Product[];
}) {
  const categories = useMemo(
    () => Array.from(new Set(products.map((product) => product.category))),
    [products],
  );
  const [active, setActive] = useState(categories[0] || "");
  const [query, setQuery] = useState("");
  const [sheet, setSheet] = useState<Product | null>(null);
  const { addItem, count, items, storeId } = useCart();
  const { t } = useI18n();
  const { activeOrders, activeRides } = useLiveActivity();
  const hasOngoing = activeOrders.length + activeRides.length > 0;

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return products
      .filter((product) => (term ? true : product.category === active))
      .filter((product) =>
        term
          ? `${product.name} ${product.description}`.toLowerCase().includes(term)
          : true,
      );
  }, [products, active, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const product of visible) {
      const list = map.get(product.category) || [];
      list.push(product);
      map.set(product.category, list);
    }
    return Array.from(map.entries());
  }, [visible]);

  const upsell = useMemo(() => {
    const drinks = products.filter(
      (product) =>
        product.available &&
        /drink|juice|coffee|tea|soda|water/i.test(product.category) &&
        product.price <= 30,
    );
    const desserts = products.filter(
      (product) => product.available && /dessert|sweet|bread/i.test(product.category),
    );
    return [...drinks, ...desserts].slice(0, 4);
  }, [products]);

  const cartFromStore = storeId === store.id;

  function quickAdd(product: Product) {
    tapFeedback();
    if (product.modifiers?.length) {
      setSheet(product);
      return;
    }
    addItem({
      productId: product.id,
      storeId: store.id,
      storeSlug: store.slug,
      storeName: store.name,
      citySlug: store.citySlug,
      storeLat: store.lat,
      storeLng: store.lng,
      deliveryFee: store.deliveryFee,
      minOrder: store.minOrder,
      name: product.name,
      emoji: product.emoji,
      basePrice: product.price,
      price: product.price,
      options: [],
    });
  }

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[22px] font-semibold tracking-[-0.025em]">
            {t("Menu")}
          </h2>
          <p className="mt-1 text-[11px] text-muted tnum">
            {t("{count} items · prices in MAD", { count: products.length })}
          </p>
        </div>
        {store.locked ? (
          <span className="inline-flex items-center gap-1.5 text-[10px] text-muted">
            <Lock size={10} /> {t("Locked menu · demo prices")}
          </span>
        ) : null}
      </div>

      <div className="sticky top-[calc(60px+env(safe-area-inset-top))] z-20 -mx-1 mt-3 bg-paper/95 px-1 py-2">
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("Search {store}…", { store: store.name })}
            className="input h-10 w-full min-w-0 ps-9 text-[13px]"
            aria-label={t("Search menu")}
          />
        </div>
        <div className="mt-1 flex w-full min-w-0 max-w-full gap-1 overflow-x-auto border-b border-line scrollbar-none">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => {
                setActive(category);
                setQuery("");
              }}
              className={`relative whitespace-nowrap px-2.5 py-2 text-[12px] transition-colors ${
                active === category && !query
                  ? "font-semibold text-ink after:absolute after:inset-x-2.5 after:bottom-0 after:h-[2px] after:bg-brand"
                  : "text-muted hover:text-ink"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {!query && upsell.length ? (
        <section className="mt-4">
          <div className="flex items-center gap-1.5">
            <Sparkles size={12} className="text-signal" />
            <h3 className="text-[11px] font-medium text-muted">
              {t("Goes well with your order")}
            </h3>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:flex sm:overflow-x-auto sm:pb-1 scrollbar-none">
            {upsell.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => quickAdd(product)}
                className="flex min-w-0 items-center gap-2.5 rounded-[6px] border border-line bg-surface p-2 text-start transition-colors hover:border-line-strong sm:w-[190px] sm:shrink-0"
              >
                <ProductTile
                  name={product.name}
                  category={product.category}
                  className="h-9 w-9 rounded-[4px]"
                  iconSize={16}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-medium">
                    {product.name}
                  </span>
                  <span className="text-[10px] text-muted tnum">
                    {money(product.price)}
                  </span>
                </span>
                <Plus size={13} className="shrink-0 text-muted" />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-6 space-y-7">
        {grouped.map(([category, list]) => (
          <section key={category}>
            <div className="flex items-baseline justify-between border-b border-line pb-2">
              <h2 className="font-display text-[20px] font-semibold tracking-[-0.02em]">
                {category}
              </h2>
              <span className="text-[11px] text-muted tnum">
                {t("{count} items", { count: list.length })}
              </span>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {list.map((product) => (
                <article
                  key={product.id}
                  className={`group flex gap-3 rounded-[8px] border border-line bg-surface p-3 transition-colors hover:border-line-strong ${
                    product.available ? "" : "opacity-55"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => product.available && setSheet(product)}
                    className="h-[76px] w-[76px] shrink-0 overflow-hidden rounded-[6px] bg-surface-2"
                    aria-label={t("Open {product}", { product: product.name })}
                  >
                    <ProductTile
                      name={product.name}
                      category={product.category}
                      className="h-full w-full"
                      iconSize={30}
                    />
                  </button>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-[13px] font-semibold leading-tight">
                          {product.name}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted">
                          {product.description}
                        </p>
                      </div>
                      {product.popular ? (
                        <span className="shrink-0 text-[10px] text-signal">
                          {t("Popular")}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <span className="text-[14px] font-semibold tnum">
                        {money(product.price)}
                        {product.modifiers?.length ? (
                          <span className="ms-1 text-[10px] font-normal text-muted">
                            {t("+ options")}
                          </span>
                        ) : null}
                      </span>
                      <button
                        type="button"
                        disabled={!product.available || !store.isOpen}
                        onClick={() => quickAdd(product)}
                        className="grid h-8 w-8 place-items-center rounded-[4px] border border-line-strong text-ink transition-colors hover:border-ink hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:border-line disabled:text-muted/40 disabled:hover:bg-transparent"
                        aria-label={t("Add {product} to cart", {
                          product: product.name,
                        })}
                      >
                        <Plus size={15} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
        {!grouped.length ? (
          <div className="border-y border-line py-12 text-center text-[13px] text-muted">
            {t("No items match your search.")}
          </div>
        ) : null}
      </div>

      {sheet ? (
        <ProductSheet product={sheet} store={store} onClose={() => setSheet(null)} />
      ) : null}

      {cartFromStore && items.length ? (
        <div
          className={`fixed inset-x-3 z-30 md:hidden ${
            hasOngoing
              ? "bottom-[calc(196px+env(safe-area-inset-bottom))]"
              : "bottom-[calc(78px+env(safe-area-inset-bottom))]"
          }`}
        >
          <a
            href="/cart"
            className="flex items-center justify-between gap-3 rounded-[8px] bg-ink px-4 py-3 text-on-dark shadow-lg"
          >
            <span className="text-[12px] font-medium tnum">
              {t(count === 1 ? "{count} item" : "{count} items", { count })} ·{" "}
              {money(items.reduce((sum, item) => sum + item.price * item.qty, 0))}
            </span>
            <span className="flex items-center gap-1 text-[12px] font-semibold text-saffron">
              {t("View cart")}
            </span>
          </a>
        </div>
      ) : null}
    </div>
  );
}
