"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Clock3,
  Heart,
  ListPlus,
  Minus,
  Plus,
  Search,
  ShoppingBasket,
  Sparkles,
  Star,
  Truck,
  X,
} from "lucide-react";
import type {
  GrocerySettings,
  Product,
  ProductVariant,
  Store,
} from "@/lib/types";
import type { GroceryAvailability } from "@/lib/grocery";
import { stockBadge } from "@/lib/grocery";
import { useCart } from "@/components/cart-provider";
import { useI18n } from "@/components/locale-provider";
import { ProductTile } from "@/components/product-icon";
import { useLiveEvents } from "@/lib/use-live-events";
import { money } from "@/lib/utils";

export function GroceryStore({
  store,
  photo,
  products,
  settings,
  availability,
  loyaltyPoints,
  favorites: initialFavorites,
  signedIn,
}: {
  store: Store;
  photo: string;
  products: Product[];
  settings: GrocerySettings;
  availability: GroceryAvailability;
  loyaltyPoints: number;
  favorites: string[];
  signedIn: boolean;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const { addItem, items, count } = useCart();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<"popular" | "price-asc" | "price-desc" | "name">(
    "popular",
  );
  const [sheet, setSheet] = useState<Product | null>(null);
  const [favorites, setFavorites] = useState<string[]>(initialFavorites);
  const [toast, setToast] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  useLiveEvents({ storeId: store.id }, () => router.refresh());

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const product of products) {
      map.set(product.category, (map.get(product.category) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [products]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return products
      .filter((product) => category === "all" || product.category === category)
      .filter((product) =>
        term
          ? `${product.name} ${product.description} ${product.brand ?? ""} ${product.sku ?? ""} ${product.barcode ?? ""}`
              .toLowerCase()
              .includes(term)
          : true,
      )
      .filter((product) => {
        if (!onlyAvailable) return true;
        if (product.variants?.length) {
          return product.variants.some((variant) => variant.stock > 0);
        }
        return product.stock === undefined || product.stock > 0;
      })
      .sort((a, b) => {
        if (sort === "popular") {
          return Number(Boolean(b.popular)) - Number(Boolean(a.popular)) || a.name.localeCompare(b.name);
        }
        if (sort === "price-asc") return a.price - b.price;
        if (sort === "price-desc") return b.price - a.price;
        return a.name.localeCompare(b.name);
      });
  }, [products, category, query, sort, onlyAvailable]);

  const cartFromStore = items[0]?.storeId === store.id;

  function add(product: Product, variant?: ProductVariant, qty = 1) {
    if (product.variants?.length && !variant) {
      setSheet(product);
      return;
    }
    const stock = variant?.stock ?? product.stock;
    if (!product.available || stock === 0) return;
    const price = variant?.price ?? product.price;
    addItem(
      {
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
        emoji: "",
        basePrice: product.price,
        price,
        storeCategory: "grocery",
        variantId: variant?.id,
        variantLabel: variant?.label,
        sku: variant?.sku ?? product.sku,
        unit: variant?.unit ?? product.unit,
        stockMax: stock,
        options: variant
          ? [
              {
                groupId: "__variant",
                groupName: t("Size"),
                optionId: variant.id,
                optionName: variant.label,
                priceDelta: variant.price - product.price,
              },
            ]
          : [],
      },
      qty,
    );
    setToast(`${product.name}${variant ? ` · ${variant.label}` : ""} ${t("added to cart")}`);
    window.setTimeout(() => setToast(""), 1800);
    setSheet(null);
  }

  async function saveToList(product: Product) {
    if (!signedIn) {
      router.push(`/login?next=grocery/${store.slug}`);
      return;
    }
    const response = await fetch("/api/grocery/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: product.id, qty: 1 }),
    });
    if (response.ok) {
      setToast(`${product.name} ${t("saved to your list")}`);
      window.setTimeout(() => setToast(""), 1800);
    }
  }

  async function toggleFavorite(productId: string) {
    if (!signedIn) {
      router.push(`/login?next=grocery/${store.slug}`);
      return;
    }
    const next = favorites.includes(productId)
      ? favorites.filter((id) => id !== productId)
      : [...favorites, productId];
    setFavorites(next);
    await fetch("/api/grocery/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    }).catch(() => setFavorites(favorites));
  }

  return (
    <div>
      <section className="relative overflow-hidden rounded-[28px] bg-ink text-on-dark">
        <div className="absolute inset-0">
          <Image src={photo} alt={store.name} fill priority sizes="100vw" className="object-cover opacity-55" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/60 to-ink/10" />
        </div>
        <div className="relative p-6 sm:p-9">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wide text-saffron">
                <ShoppingBasket size={11} /> {t("Supermarket")}
              </span>
              <h1 className="display mt-3 text-4xl sm:text-6xl">{store.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] font-bold text-on-dark/65">
                <span className="inline-flex items-center gap-1">
                  <Star size={12} className="fill-saffron text-saffron" />
                  {store.rating || "New"} · {store.reviews} {t("reviews")}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock3 size={12} className="text-saffron" />
                  {store.prepTime}–{store.prepTime + 10} min
                </span>
                <span>{store.address}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span
                className={`rounded-full px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wide ${
                  availability.open ? "bg-teal text-on-dark" : "bg-coral text-on-dark"
                }`}
              >
                {availability.open ? t(availability.label) : t("Closed")}
              </span>
              {loyaltyPoints > 0 ? (
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-extrabold">
                  {loyaltyPoints} {t("loyalty points")}
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-extrabold">
            {availability.delivery ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5">
                <Truck size={11} className="text-saffron" />
                {t("Delivery from {amount}", { amount: money(settings.deliveryZones[0]?.fee ?? store.deliveryFee) })}
              </span>
            ) : null}
            {availability.pickup ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5">
                <ShoppingBasket size={11} className="text-saffron" /> {t("Pickup")}
              </span>
            ) : null}
            {availability.express ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5">
                <Sparkles size={11} className="text-saffron" /> {t("Express in {min} min", { min: settings.expressMinutes })}
              </span>
            ) : null}
            {availability.night ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5">
                {t("Night fee {amount}", { amount: money(settings.nightFee) })}
              </span>
            ) : null}
          </div>

          {!availability.open || !availability.delivery ? (
            <p className="mt-4 max-w-2xl rounded-xl bg-white/10 px-3 py-2 text-[11px] font-bold text-on-dark/70">
              {availability.reason ||
                (availability.pickup
                  ? t("Delivery is unavailable — pickup is still available.")
                  : t("Ordering is paused until the store is staffed."))}
            </p>
          ) : null}
        </div>
      </section>

      {toast ? (
        <div className="fixed bottom-[calc(90px+env(safe-area-inset-bottom))] start-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-xs font-bold text-on-dark shadow-2xl rtl:translate-x-1/2">
          {toast}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[230px_1fr]">
        <aside className="card hidden h-fit p-3 lg:sticky lg:top-24 lg:block">
          <div className="px-2 pb-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink/35">
            {t("Departments")}
          </div>
          <button
            type="button"
            onClick={() => setCategory("all")}
            className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-extrabold ${
              category === "all" ? "bg-teal text-on-dark" : "text-ink/55 hover:bg-cream"
            }`}
          >
            {t("All products")}
            <span className="text-[9px] opacity-70">{products.length}</span>
          </button>
          <div className="mt-1 grid gap-0.5">
            {categories.map(([name, total]) => (
              <button
                key={name}
                type="button"
                onClick={() => setCategory(name)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-bold ${
                  category === name ? "bg-cream text-ink" : "text-ink/50 hover:bg-cream"
                }`}
              >
                <span className="truncate">{name}</span>
                <span className="text-[9px] text-ink/30">{total}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="min-w-0">
          <div className="mb-2 flex gap-2 overflow-x-auto pb-1 scrollbar-none lg:hidden">
            <button
              type="button"
              onClick={() => setCategory("all")}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[10px] font-extrabold ${
                category === "all" ? "bg-teal text-on-dark" : "border border-ink/10 bg-white/60 text-ink/55"
              }`}
            >
              {t("All products")}
            </button>
            {categories.map(([name]) => (
              <button
                key={name}
                type="button"
                onClick={() => setCategory(name)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[10px] font-extrabold ${
                  category === name ? "bg-teal text-on-dark" : "border border-ink/10 bg-white/60 text-ink/55"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="sticky top-[calc(68px+env(safe-area-inset-top))] z-20 -mx-1 bg-cream/90 px-1 py-2 backdrop-blur">
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-ink/35"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="input h-11 ps-10"
                placeholder={t("Search {store}…", { store: store.name })}
                aria-label={t("Search products")}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as typeof sort)}
                className="input h-9 w-auto min-w-[9rem] text-[11px]"
                aria-label={t("Sort products")}
              >
                <option value="popular">{t("Popular first")}</option>
                <option value="price-asc">{t("Price: low to high")}</option>
                <option value="price-desc">{t("Price: high to low")}</option>
                <option value="name">{t("Name A–Z")}</option>
              </select>
              <label className="inline-flex items-center gap-1.5 rounded-xl border border-ink/10 bg-white/60 px-3 py-2 text-[10px] font-extrabold text-ink/55">
                <input
                  type="checkbox"
                  checked={onlyAvailable}
                  onChange={(event) => setOnlyAvailable(event.target.checked)}
                  className="h-3.5 w-3.5 accent-teal"
                />
                {t("In stock only")}
              </label>
              {cartFromStore && count > 0 ? (
                <a href="/cart" className="btn btn-primary btn-sm ms-auto">
                  {t("View cart")} · {count}
                  <ArrowRight size={12} className="rtl:-scale-x-100" />
                </a>
              ) : null}
            </div>
          </div>

          {!availability.open ? (
            <div className="mt-3 rounded-xl bg-saffron/15 px-3 py-2 text-[11px] font-bold text-saffron-deep">
              {t("The store is closed. You can browse, but checkout is paused.")}
            </div>
          ) : null}

          <div className="mt-3 flex items-end justify-between">
            <h2 className="text-xl font-extrabold tracking-[-0.04em]">
              {category === "all" ? t("All products") : category}
            </h2>
            <span className="text-[10px] font-bold text-ink/30">
              {visible.length} {t("products")}
            </span>
          </div>

          {visible.length ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((product) => {
                const variantStocks = product.variants?.map((variant) => variant.stock) ?? [];
                const stock =
                  product.variants?.length
                    ? Math.max(0, ...variantStocks)
                    : product.stock;
                const badge = stockBadge(stock, product.lowStockThreshold);
                const soldOut = !product.available || (stock !== undefined && stock <= 0);
                const favorite = favorites.includes(product.id);
                return (
                  <article
                    key={product.id}
                    className={`card-flat group flex gap-3 p-3 transition ${
                      soldOut ? "opacity-65" : "hover:border-teal/25 hover:shadow-md"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSheet(product)}
                      className="h-[74px] w-[74px] shrink-0 overflow-hidden rounded-2xl ring-1 ring-inset ring-ink/5"
                      aria-label={t("View {product}", { product: product.name })}
                    >
                      <ProductTile
                        name={product.name}
                        category={product.category}
                        className="h-full w-full rounded-2xl"
                        iconSize={30}
                      />
                    </button>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          {product.brand ? (
                            <div className="text-[9px] font-extrabold uppercase tracking-wide text-ink/30">
                              {product.brand}
                            </div>
                          ) : null}
                          <h3 className="truncate text-[13px] font-extrabold">{product.name}</h3>
                          <div className="text-[10px] font-bold text-ink/40">
                            {product.unit || product.variants?.[0]?.unit || ""}
                            {product.unit && product.unit !== "each" ? "" : ""}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleFavorite(product.id)}
                          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition ${
                            favorite ? "bg-coral/10 text-coral" : "text-ink/25 hover:bg-cream hover:text-coral"
                          }`}
                          aria-label={favorite ? t("Remove from favourites") : t("Add to favourites")}
                        >
                          <Heart size={14} className={favorite ? "fill-coral" : ""} />
                        </button>
                      </div>

                      <div className="mt-1 line-clamp-2 text-[10px] leading-4 text-ink/40">
                        {product.description}
                      </div>

                      <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                        <div>
                          <div className="text-sm font-extrabold">{money(product.price)}</div>
                          <span
                            className={`mt-0.5 inline-flex rounded-full px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wide ${
                              badge.tone === "out"
                                ? "bg-red-50 text-red-500"
                                : badge.tone === "low"
                                  ? "bg-saffron/20 text-saffron-deep"
                                  : "bg-teal/10 text-teal"
                            }`}
                          >
                            {stock === undefined ? t("In stock") : badge.tone === "low"
                              ? t("Only {count} left", { count: stock ?? 0 })
                              : badge.tone === "out"
                                ? t("Sold out")
                                : t("In stock")}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => add(product)}
                          disabled={soldOut}
                          className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-on-dark transition hover:bg-teal disabled:cursor-not-allowed disabled:bg-ink/20"
                          aria-label={t("Add {product} to cart", { product: product.name })}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="card mt-3 grid place-items-center px-6 py-14 text-center">
              <ShoppingBasket size={26} className="text-teal" />
              <h3 className="mt-3 text-lg font-extrabold">{t("No products match")}</h3>
              <p className="mt-1 text-sm text-ink/45">
                {t("Try a different department, search or filter.")}
              </p>
            </div>
          )}
        </div>
      </div>

      {sheet ? (
        <GrocerySheet
          product={sheet}
          onClose={() => setSheet(null)}
          onAdd={(variant, qty) => add(sheet, variant, qty)}
          onSaveToList={() => saveToList(sheet)}
        />
      ) : null}
    </div>
  );
}

function GrocerySheet({
  product,
  onClose,
  onAdd,
  onSaveToList,
}: {
  product: Product;
  onClose: () => void;
  onAdd: (variant: ProductVariant | undefined, qty: number) => void;
  onSaveToList: () => void;
}) {
  const { t } = useI18n();
  const [variantId, setVariantId] = useState(
    product.variants?.find((variant) => variant.stock > 0)?.id ?? product.variants?.[0]?.id,
  );
  const [qty, setQty] = useState(1);
  const variant = product.variants?.find((item) => item.id === variantId);
  const price = variant?.price ?? product.price;
  const stock = variant?.stock ?? product.stock;
  const soldOut =
    !product.available || stock === 0 || Boolean(product.variants?.length && !variant);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/50 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-ink/8 p-4">
          <ProductTile
            name={product.name}
            category={product.category}
            className="h-14 w-14 rounded-2xl"
            iconSize={24}
          />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-extrabold">{product.name}</h2>
            <div className="text-[11px] font-bold text-ink/40">
              {product.brand ? `${product.brand} · ` : ""}
              {product.unit || "each"}
            </div>
            <div className="mt-1 text-base font-extrabold">{money(price)}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink/40 hover:bg-cream hover:text-ink"
            aria-label={t("Close")}
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-4">
          <p className="text-sm leading-6 text-ink/55">{product.description}</p>
          {product.sku ? (
            <div className="mt-2 text-[10px] font-bold text-ink/30">
              SKU {product.sku} {product.barcode ? `· ${product.barcode}` : ""}
            </div>
          ) : null}

          {product.variants?.length ? (
            <div className="mt-4">
              <div className="label">{t("Choose a size")}</div>
              <div className="grid gap-2">
                {product.variants.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={item.stock <= 0}
                    onClick={() => setVariantId(item.id)}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-xs transition ${
                      variantId === item.id
                        ? "border-teal bg-teal/5"
                        : "border-ink/10 hover:border-teal/30"
                    } ${item.stock <= 0 ? "opacity-40" : ""}`}
                  >
                    <span className="font-extrabold">{item.label}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-extrabold">{money(item.price)}</span>
                      <span className="text-[9px] font-bold text-ink/35">
                        {item.stock > 0 ? t("{count} left", { count: item.stock }) : t("Sold out")}
                      </span>
                      {variantId === item.id ? <Check size={13} className="text-teal" /> : null}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex items-center justify-between rounded-xl bg-cream p-3">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-ink/40">
              {t("Quantity")}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setQty((value) => Math.max(1, value - 1))}
                className="grid h-8 w-8 place-items-center rounded-lg border border-ink/10 hover:bg-white"
                aria-label={t("Decrease quantity")}
              >
                <Minus size={14} />
              </button>
              <span className="w-8 text-center text-sm font-extrabold">{qty}</span>
              <button
                type="button"
                onClick={() =>
                  setQty((value) =>
                    Math.min(20, stock ?? 20, value + 1),
                  )
                }
                className="grid h-8 w-8 place-items-center rounded-lg border border-ink/10 hover:bg-white"
                aria-label={t("Increase quantity")}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-ink/8 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex gap-2">
            <button type="button" onClick={onSaveToList} className="btn btn-ghost">
              <ListPlus size={15} />
              {t("Save to list")}
            </button>
            <button
              type="button"
              onClick={() => onAdd(variant, qty)}
              disabled={soldOut}
              className="btn btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {soldOut
                ? t("Sold out")
                : `${t("Add to cart")} · ${money(price * qty)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
