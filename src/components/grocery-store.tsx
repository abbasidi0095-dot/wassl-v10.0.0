"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Clock3,
  Heart,
  ListPlus,
  Minus,
  Plus,
  Search,
  ShoppingBasket,
  Star,
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
          return (
            Number(Boolean(b.popular)) - Number(Boolean(a.popular)) ||
            a.name.localeCompare(b.name)
          );
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
    setToast(
      `${product.name}${variant ? ` · ${variant.label}` : ""} ${t("added to cart")}`,
    );
    window.setTimeout(() => setToast(""), 1800);
    setSheet(null);
  }

  async function saveToList(product: Product) {
    if (!signedIn) {
      router.push(`/login?next=store/${store.slug}`);
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
      router.push(`/login?next=store/${store.slug}`);
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
      {/* Store header: facts on paper, one photograph. */}
      <div className="grid gap-6 border-b border-line pb-7 lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:gap-10">
        <div>
          <nav className="flex items-center gap-2 text-[11px] text-muted" aria-label="Breadcrumb">
            <a href="/grocery" className="hover:text-ink">
              {t("Grocery")}
            </a>
            <span className="text-line-strong">/</span>
            <span className="text-ink">{store.name}</span>
          </nav>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span
                className={`status-dot ${availability.open ? "live-dot" : ""} ${
                  availability.open ? "text-success" : "text-danger"
                }`}
              />
              {availability.open ? t(availability.label) : t("Closed")}
            </span>
            <span className="text-line-strong">/</span>
            <span>{store.citySlug}</span>
            <span className="text-line-strong">/</span>
            <span className="tnum">
              {store.prepTime}–{store.prepTime + 10} min
            </span>
            {store.rating ? (
              <>
                <span className="text-line-strong">/</span>
                <span className="inline-flex items-center gap-1 tnum">
                  <Star size={10} className="fill-signal text-signal" />
                  {store.rating} · {store.reviews} {t("reviews")}
                </span>
              </>
            ) : null}
          </div>

          <h1 className="display mt-4 text-[clamp(2.4rem,1.6rem+3vw,4.2rem)]">
            {store.name}
          </h1>

          <p className="mt-3 max-w-[52ch] text-[14px] leading-6 text-muted" dir="auto">
            {store.description}
          </p>

          <dl className="mt-5 flex flex-wrap gap-x-7 gap-y-2 text-[12px]">
            {availability.delivery ? (
              <div>
                <dt className="inline text-muted">{t("Delivery")} </dt>
                <dd className="inline font-medium tnum">
                  {t("from {amount}", {
                    amount: money(
                      settings.deliveryZones[0]?.fee ?? store.deliveryFee,
                    ),
                  })}
                </dd>
              </div>
            ) : null}
            {availability.pickup ? (
              <div>
                <dt className="inline text-muted">{t("Pickup")} </dt>
                <dd className="inline font-medium">{t("free")}</dd>
              </div>
            ) : null}
            <div>
              <dt className="inline text-muted">{t("Minimum")} </dt>
              <dd className="inline font-medium tnum">
                {money(settings.deliveryZones[0]?.minOrder ?? store.minOrder)}
              </dd>
            </div>
            {availability.express ? (
              <div>
                <dt className="inline text-muted">{t("Express")} </dt>
                <dd className="inline font-medium">
                  {settings.expressMinutes} min · {money(settings.expressFee)}
                </dd>
              </div>
            ) : null}
            {availability.night ? (
              <div>
                <dt className="inline text-muted">{t("Night fee")} </dt>
                <dd className="inline font-medium tnum">
                  {money(settings.nightFee)}
                </dd>
              </div>
            ) : null}
            {loyaltyPoints > 0 ? (
              <div>
                <dt className="inline text-muted">{t("Loyalty")} </dt>
                <dd className="inline font-medium tnum">
                  {loyaltyPoints} {t("points")}
                </dd>
              </div>
            ) : null}
          </dl>

          {!availability.open || !availability.delivery ? (
            <p className="mt-4 max-w-[58ch] border-s-2 border-signal ps-3 text-[12px] leading-5 text-muted">
              {availability.reason ||
                (availability.pickup
                  ? t("Delivery is unavailable — pickup is still available.")
                  : t("Ordering is paused until the store is staffed."))}
            </p>
          ) : null}
        </div>

        <div className="relative order-first aspect-[16/10] overflow-hidden rounded-[10px] bg-surface-2 lg:order-none lg:aspect-[16/11]">
          <Image
            src={photo}
            alt={store.name}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 42vw"
            className="object-cover"
          />
        </div>
      </div>

      {toast ? (
        <div className="fixed bottom-[calc(84px+env(safe-area-inset-bottom))] start-1/2 z-50 -translate-x-1/2 rounded-[6px] bg-ink px-4 py-2 text-[12px] font-medium text-on-dark shadow-lg rtl:translate-x-1/2">
          {toast}
        </div>
      ) : null}

      <div className="mt-6 grid gap-8 lg:grid-cols-[200px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <p className="text-[11px] font-medium text-muted">{t("Departments")}</p>
            <div className="mt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setCategory("all")}
                className={`flex w-full items-center justify-between border-b border-line py-2.5 text-start text-[13px] transition-colors ${
                  category === "all" ? "font-semibold text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {t("All products")}
                <span className="tnum text-[11px] text-muted">{products.length}</span>
              </button>
              {categories.map(([name, total]) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setCategory(name)}
                  className={`flex w-full items-center justify-between border-b border-line py-2.5 text-start text-[13px] transition-colors ${
                    category === name ? "font-semibold text-ink" : "text-muted hover:text-ink"
                  }`}
                >
                  <span className="truncate">{name}</span>
                  <span className="tnum text-[11px] text-muted">{total}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="flex flex-col gap-3 border-y border-line py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-[340px]">
              <Search
                size={15}
                className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="input h-10 ps-9 text-[13px]"
                placeholder={t("Search {store}…", { store: store.name })}
                aria-label={t("Search products")}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as typeof sort)}
                className="h-10 rounded-[6px] border border-line bg-surface px-2.5 text-[12px] font-medium text-muted outline-none focus:border-brand"
                aria-label={t("Sort products")}
              >
                <option value="popular">{t("Popular first")}</option>
                <option value="price-asc">{t("Price: low to high")}</option>
                <option value="price-desc">{t("Price: high to low")}</option>
                <option value="name">{t("Name A–Z")}</option>
              </select>
              <label className="inline-flex h-10 items-center gap-2 rounded-[6px] border border-line px-3 text-[12px] font-medium text-muted">
                <input
                  type="checkbox"
                  checked={onlyAvailable}
                  onChange={(event) => setOnlyAvailable(event.target.checked)}
                  className="h-3.5 w-3.5 accent-[var(--brand)]"
                />
                {t("In stock only")}
              </label>
              {cartFromStore && count > 0 ? (
                <a href="/cart" className="btn btn-primary btn-sm h-10 sm:ms-1">
                  {t("Basket")} · {count}
                </a>
              ) : null}
            </div>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none lg:hidden">
            <button
              type="button"
              onClick={() => setCategory("all")}
              className={`min-h-9 whitespace-nowrap rounded-[2px] px-2.5 py-2 text-[12px] transition-colors ${
                category === "all"
                  ? "bg-ink font-semibold text-paper"
                  : "text-muted hover:text-ink"
              }`}
            >
              {t("All products")}
            </button>
            {categories.map(([name]) => (
              <button
                key={name}
                type="button"
                onClick={() => setCategory(name)}
                className={`min-h-9 whitespace-nowrap rounded-[2px] px-2.5 py-2 text-[12px] transition-colors ${
                  category === name
                    ? "bg-ink font-semibold text-paper"
                    : "text-muted hover:text-ink"
                }`}
              >
                {name}
              </button>
            ))}
          </div>

          <div className="mt-5 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-[22px] font-semibold tracking-[-0.025em]">
              {category === "all" ? t("All products") : category}
            </h2>
            <span className="text-[11px] text-muted tnum">
              {visible.length} {t("products")}
            </span>
          </div>

          {visible.length ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((product) => {
                const variantStocks =
                  product.variants?.map((variant) => variant.stock) ?? [];
                const stock = product.variants?.length
                  ? Math.max(0, ...variantStocks)
                  : product.stock;
                const badge = stockBadge(stock, product.lowStockThreshold);
                const soldOut =
                  !product.available || (stock !== undefined && stock <= 0);
                const favorite = favorites.includes(product.id);
                return (
                  <article
                    key={product.id}
                    className={`group relative flex gap-3 rounded-[8px] border border-line bg-surface p-3 transition-colors hover:border-line-strong ${
                      soldOut ? "opacity-70" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSheet(product)}
                      className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-[6px] bg-surface-2"
                      aria-label={t("View {product}", { product: product.name })}
                    >
                      <ProductTile
                        name={product.name}
                        category={product.category}
                        className="h-full w-full"
                        iconSize={28}
                      />
                    </button>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0">
                          {product.brand ? (
                            <div className="text-[10px] text-muted">
                              {product.brand}
                            </div>
                          ) : null}
                          <h3 className="truncate text-[13px] font-semibold leading-tight">
                            {product.name}
                          </h3>
                          <div className="mt-0.5 truncate text-[11px] text-muted">
                            {product.unit || product.variants?.[0]?.unit || t("each")}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleFavorite(product.id)}
                          className={`grid h-7 w-7 shrink-0 place-items-center rounded-[4px] transition-colors ${
                            favorite
                              ? "text-danger"
                              : "text-muted/50 hover:text-danger"
                          }`}
                          aria-label={
                            favorite
                              ? t("Remove from favourites")
                              : t("Add to favourites")
                          }
                        >
                          <Heart
                            size={14}
                            className={favorite ? "fill-current" : ""}
                          />
                        </button>
                      </div>

                      <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                        <div>
                          <div className="text-[14px] font-semibold tnum">
                            {money(product.price)}
                          </div>
                          <div
                            className={`mt-0.5 text-[10px] ${
                              badge.tone === "out"
                                ? "text-danger"
                                : badge.tone === "low"
                                  ? "text-signal"
                                  : "text-muted"
                            }`}
                          >
                            {stock === undefined
                              ? t("In stock")
                              : badge.tone === "low"
                                ? t("Only {count} left", { count: stock })
                                : badge.tone === "out"
                                  ? t("Sold out")
                                  : t("In stock")}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => add(product)}
                          disabled={soldOut}
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
                );
              })}
            </div>
          ) : (
            <div className="mt-3 border-y border-line py-14 text-center">
              <ShoppingBasket size={22} className="mx-auto text-muted" />
              <h3 className="mt-3 font-display text-lg font-semibold">
                {t("No products match")}
              </h3>
              <p className="mt-1 text-[12px] text-muted">
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
    product.variants?.find((variant) => variant.stock > 0)?.id ??
      product.variants?.[0]?.id,
  );
  const [qty, setQty] = useState(1);
  const variant = product.variants?.find((item) => item.id === variantId);
  const price = variant?.price ?? product.price;
  const stock = variant?.stock ?? product.stock;
  const soldOut =
    !product.available ||
    stock === 0 ||
    Boolean(product.variants?.length && !variant);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/50 backdrop-blur-[2px] sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
      onClick={onClose}
    >
      <div
        className="sheet-in w-full max-w-[440px] overflow-hidden rounded-t-[16px] bg-surface shadow-2xl sm:rounded-[12px]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-line p-4">
          <ProductTile
            name={product.name}
            category={product.category}
            className="h-14 w-14 rounded-[6px]"
            iconSize={24}
          />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[20px] font-semibold leading-tight tracking-[-0.02em]">
              {product.name}
            </h2>
            <div className="mt-0.5 text-[11px] text-muted">
              {product.brand ? `${product.brand} · ` : ""}
              {product.unit || t("each")}
            </div>
            <div className="mt-1 text-[15px] font-semibold tnum">
              {money(price)}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-[4px] text-muted hover:bg-surface-2 hover:text-ink"
            aria-label={t("Close")}
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-4">
          <p className="text-[13px] leading-6 text-muted">{product.description}</p>
          {product.sku ? (
            <div className="mt-2 text-[10px] text-muted tnum">
              {t("SKU")} {product.sku}
              {product.barcode ? ` · ${product.barcode}` : ""}
            </div>
          ) : null}

          {product.variants?.length ? (
            <div className="mt-5">
              <div className="label">{t("Choose a size")}</div>
              <div className="grid gap-2">
                {product.variants.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={item.stock <= 0}
                    onClick={() => setVariantId(item.id)}
                    className={`flex items-center justify-between rounded-[6px] border px-3 py-2.5 text-start text-[12px] transition-colors ${
                      variantId === item.id
                        ? "border-ink bg-surface-2"
                        : "border-line hover:border-line-strong"
                    } ${item.stock <= 0 ? "opacity-40" : ""}`}
                  >
                    <span className="font-medium">{item.label}</span>
                    <span className="flex items-center gap-3">
                      <span className="font-semibold tnum">
                        {money(item.price)}
                      </span>
                      <span className="text-[10px] text-muted tnum">
                        {item.stock > 0
                          ? t("{count} left", { count: item.stock })
                          : t("Sold out")}
                      </span>
                      {variantId === item.id ? <Check size={13} /> : null}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-5 flex items-center justify-between border-y border-line py-3">
            <span className="text-[12px] font-medium">{t("Quantity")}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setQty((value) => Math.max(1, value - 1))}
                className="grid h-8 w-8 place-items-center rounded-[4px] border border-line hover:bg-surface-2"
                aria-label={t("Decrease quantity")}
              >
                <Minus size={14} />
              </button>
              <span className="w-8 text-center text-[13px] font-semibold tnum">
                {qty}
              </span>
              <button
                type="button"
                onClick={() =>
                  setQty((value) => Math.min(20, stock ?? 20, value + 1))
                }
                className="grid h-8 w-8 place-items-center rounded-[4px] border border-line hover:bg-surface-2"
                aria-label={t("Increase quantity")}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-line p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex gap-2">
            <button type="button" onClick={onSaveToList} className="btn btn-ghost">
              <ListPlus size={15} />
              {t("Save to list")}
            </button>
            <button
              type="button"
              onClick={() => onAdd(variant, qty)}
              disabled={soldOut}
              className="btn btn-primary flex-1 disabled:cursor-not-allowed"
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
