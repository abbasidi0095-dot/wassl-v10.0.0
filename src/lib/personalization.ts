import { getOpenState } from "./hours";
import type { Order, Product, Store } from "./types";
import { PROMOS, type PromoRule } from "./promos";
import { storePhoto } from "./store-images";

export type HomeFeedSlot =
  | "breakfast"
  | "lunch"
  | "afternoon"
  | "dinner"
  | "late"
  | "popular";

export type HomeFeedReason =
  | "reorder"
  | "frequent"
  | "popular"
  | "nearby"
  | "favourite";

export type HomeFeedItem = {
  id: string;
  kind: "store" | "product";
  title: string;
  subtitle: string;
  href: string;
  image?: string;
  category?: string;
  price?: number;
  reason: HomeFeedReason;
  score: number;
};

export type HomeFeed = {
  slot: HomeFeedSlot;
  personalized: boolean;
  items: HomeFeedItem[];
  promos: PromoRule[];
};

export type HomeFeedInput = {
  citySlug: string;
  stores: Store[];
  popularProducts?: Array<{ product: Product; store: Store }>;
  orders?: Order[];
  favouriteProductIds?: string[];
  now?: Date;
  limit?: number;
};

function slotFor(now: Date): HomeFeedSlot {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Casablanca",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "12");
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 15) return "lunch";
  if (hour >= 15 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 23) return "dinner";
  return "late";
}

function slotBoost(store: Store, slot: HomeFeedSlot): number {
  if (slot === "breakfast" || slot === "afternoon") {
    return store.category === "cafe" ? 8 : 0;
  }
  if (slot === "lunch" || slot === "dinner") {
    return store.category === "restaurant" ? 8 : 0;
  }
  if (slot === "late") {
    return store.category === "grocery" || store.category === "restaurant" ? 5 : 0;
  }
  return 0;
}

function shortImage(value: string | undefined): string | undefined {
  return value?.startsWith("data:") ? undefined : value;
}

/**
 * Builds a deterministic home feed from real orders, favourites, stock and
 * opening hours. No external personalization or AI provider is involved.
 */
export function buildHomeFeed(input: HomeFeedInput): HomeFeed {
  const now = input.now ?? new Date();
  const slot = slotFor(now);
  const cityStores = input.stores.filter((store) => store.citySlug === input.citySlug);
  const storeById = new Map(input.stores.map((store) => [store.id, store]));
  const orders = [...(input.orders ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const items: HomeFeedItem[] = [];
  const seen = new Set<string>();

  function push(item: HomeFeedItem) {
    const key = `${item.kind}:${item.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push(item);
  }

  // Reorder the most recent basket first.
  const lastOrder = orders[0];
  if (lastOrder) {
    const store = storeById.get(lastOrder.storeId);
    if (store) {
      lastOrder.items.slice(0, 3).forEach((line, index) => {
        push({
          id: line.productId,
          kind: "product",
          title: line.name,
          subtitle: store.name,
          href: `/store/${store.slug}?product=${encodeURIComponent(line.productId)}`,
          image: shortImage(line.image),
          category: store.category,
          price: line.price,
          reason: "reorder",
          score: 110 - index,
        });
      });
    }
  }

  // Frequently ordered stores.
  const orderCounts = new Map<string, number>();
  for (const order of orders) {
    orderCounts.set(order.storeId, (orderCounts.get(order.storeId) ?? 0) + 1);
  }
  const frequentStores = [...orderCounts.entries()]
    .map(([storeId, count]) => ({
      store: storeById.get(storeId),
      count,
    }))
    .filter((entry): entry is { store: Store; count: number } => Boolean(entry.store))
    .sort((a, b) => b.count - a.count)
    .slice(0, 2);
  for (const { store, count } of frequentStores) {
    push({
      id: store.id,
      kind: "store",
      title: store.name,
      subtitle: store.tagline,
      href: `/store/${store.slug}`,
      image: storePhoto(store),
      reason: "frequent",
      score: 80 + Math.min(10, count * 2) + slotBoost(store, slot),
    });
  }

  // Popular grocery products.
  const favouriteIds = new Set(input.favouriteProductIds ?? []);
  for (const { product, store } of input.popularProducts ?? []) {
    if (!product.available) continue;
    const favourite = favouriteIds.has(product.id);
    push({
      id: product.id,
      kind: "product",
      title: product.name,
      subtitle: store.name,
      href: `/store/${store.slug}?product=${encodeURIComponent(product.id)}`,
      image: shortImage(product.image),
      category: product.category,
      price: product.price,
      reason: favourite ? "favourite" : "popular",
      score: (favourite ? 70 : 55) + slotBoost(store, slot),
    });
  }

  // Nearby open stores.
  const nearby = cityStores
    .filter((store) => getOpenState(store, now).open)
    .sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
  for (const store of nearby) {
    push({
      id: store.id,
      kind: "store",
      title: store.name,
      subtitle: store.tagline,
      href: `/store/${store.slug}`,
      image: storePhoto(store),
      reason: "nearby",
      score: 35 + store.rating * 2 + slotBoost(store, slot),
    });
  }

  // Cold start or an empty feed: fill with the best city stores.
  if (!items.length) {
    for (const store of cityStores
      .sort(
        (a, b) =>
          Number(getOpenState(b, now).open) - Number(getOpenState(a, now).open) ||
          b.rating - a.rating,
      )
      .slice(0, 6)) {
      push({
        id: store.id,
        kind: "store",
        title: store.name,
        subtitle: store.tagline,
        href: `/store/${store.slug}`,
        image: storePhoto(store),
        reason: "nearby",
        score: store.rating,
      });
    }
  }

  const promos = PROMOS.filter(
    (promo) => !promo.cities?.length || promo.cities.includes(input.citySlug),
  ).slice(0, 2);

  return {
    slot: orders.length ? slot : "popular",
    personalized: orders.length > 0,
    items: items
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(4, Math.min(input.limit ?? 6, 12))),
    promos,
  };
}
