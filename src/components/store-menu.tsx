"use client";

import { useMemo, useState } from "react";
import { Lock, Plus, Search, Sparkles } from "lucide-react";
import type { Product, Store } from "@/lib/types";
import { money } from "@/lib/utils";
import { tapFeedback } from "@/lib/haptics";
import { useCart } from "./cart-provider";
import { ProductSheet } from "./product-sheet";
import { ProductTile, productVisual } from "./product-icon";
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
        term ? `${product.name} ${product.description}`.toLowerCase().includes(term) : true,
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
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-extrabold tracking-[-0.04em]">{t("Menu")}</h2>
          <p className="text-[11px] font-bold text-ink/35">
            {t("{count} items · prices in MAD", { count: products.length })}
          </p>
        </div>
        {store.locked ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-wide text-ink/45">
            <Lock size={10} /> {t("Locked menu · demo prices")}
          </span>
        ) : null}
      </div>

      <div className="sticky top-[calc(68px+env(safe-area-inset-top))] z-20 mx-0 w-full min-w-0 bg-cream/90 py-3 backdrop-blur">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-ink/35"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("Search {store}…", { store: store.name })}
            className="input h-11 w-full min-w-0 bg-white/80 ps-10"
          />
        </div>
        <div className="mt-3 flex w-full min-w-0 max-w-full gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => {
                setActive(category);
                setQuery("");
              }}
              className={`whitespace-nowrap rounded-full px-3.5 py-2 text-[11px] font-extrabold transition ${
                active === category && !query
                  ? "bg-teal text-on-dark"
                  : "bg-white/70 text-ink/55 hover:text-ink"
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
            <Sparkles size={13} className="text-saffron" />
            <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-ink/45">
              {t("Goes well with your order")}
            </h3>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:flex sm:overflow-x-auto sm:pb-1 scrollbar-none">
            {upsell.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => quickAdd(product)}
                className="flex min-w-0 items-center gap-2.5 rounded-2xl border border-ink/8 bg-white/80 p-2 text-start transition hover:border-teal/30 sm:w-[190px] sm:shrink-0"
              >
                <ProductTile
                  name={product.name}
                  category={product.category}
                  className="h-9 w-9 rounded-xl"
                  iconSize={16}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-extrabold">{product.name}</span>
                  <span className="text-[10px] font-bold text-ink/40">{money(product.price)}</span>
                </span>
                <Plus size={13} className="shrink-0 text-teal" />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-3 space-y-6">
        {grouped.map(([category, list]) => (
          <section key={category}>
            <div className="flex items-end justify-between">
              <h2 className="text-xl font-extrabold tracking-[-0.04em]">{category}</h2>
              <span className="text-[10px] font-bold text-ink/30">{t("{count} items", { count: list.length })}</span>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {list.map((product) => (
                <article
                  key={product.id}
                  className={`card-flat group flex gap-3 p-3 transition ${
                    product.available ? "hover:border-teal/25 hover:shadow-md" : "opacity-55"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => product.available && setSheet(product)}
                    className="h-[86px] w-[86px] shrink-0 overflow-hidden rounded-2xl ring-1 ring-inset ring-ink/5 transition hover:ring-teal/25"
                    aria-label={t("Open {product}", { product: product.name })}
                  >
                    <ProductTile
                      name={product.name}
                      category={product.category}
                      className="h-full w-full rounded-2xl"
                      iconSize={34}
                    />
                  </button>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-[13px] font-extrabold leading-5">{product.name}</h3>
                        <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-ink/45">
                          {product.description}
                        </p>
                        {product.tags?.length ? (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {product.tags.slice(0, 2).map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full bg-teal/8 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wide text-teal"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      {product.popular ? (
                        <span className="flex shrink-0 items-center gap-1 rounded-full bg-saffron/20 px-2 py-1 text-[8px] font-extrabold uppercase tracking-wide text-ink/70">
                          <Sparkles size={9} /> {t("Popular")}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <span className="text-sm font-extrabold">
                        {money(product.price)}
                        {product.modifiers?.length ? (
                          <span className="ms-1 text-[9px] font-bold text-ink/35">{t("+ options")}</span>
                        ) : null}
                      </span>
                      <button
                        type="button"
                        disabled={!product.available || !store.isOpen}
                        onClick={() => quickAdd(product)}
                        className="grid h-8 w-8 place-items-center rounded-xl bg-ink text-on-dark transition hover:bg-teal disabled:cursor-not-allowed disabled:bg-ink/20"
                        aria-label={t("Add {product} to cart", { product: product.name })}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
        {!grouped.length ? (
          <div className="rounded-2xl border border-dashed border-ink/15 p-10 text-center text-sm text-ink/45">
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
            className="flex items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-on-dark shadow-2xl"
          >
            <span className="text-xs font-extrabold">
              {t(count === 1 ? "{count} item" : "{count} items", { count })} ·{" "}
              {money(items.reduce((sum, item) => sum + item.price * item.qty, 0))}
            </span>
            <span className="flex items-center gap-1 text-xs font-extrabold text-saffron">
              {t("View cart")} <Plus size={13} className="rtl:-scale-x-100" />
            </span>
          </a>
        </div>
      ) : null}
    </div>
  );
}
