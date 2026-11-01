import { getOpenState } from "./hours";
import type { City, Database, Store } from "./types";
import { categoryLabel } from "./utils";
import { cityServiceEnabled } from "./city-services";

export type SearchKind =
  | "store"
  | "product"
  | "category"
  | "service"
  | "delivery";

export type SearchHit = {
  id: string;
  kind: SearchKind;
  title: string;
  subtitle?: string;
  href: string;
  meta?: string;
  image?: string;
  badge?: string;
  /** True when the title is an i18n key rather than merchant data. */
  titleIsKey?: boolean;
  /** True when the subtitle is an i18n key rather than merchant data. */
  subtitleIsKey?: boolean;
  /** Structured product/store data for the grocery basket. */
  storeId?: string;
  storeSlug?: string;
  storeName?: string;
  storeCategory?: Store["category"];
  citySlug?: string;
  storeLat?: number;
  storeLng?: number;
  price?: number;
  unit?: string;
  category?: string;
  stock?: number;
  deliveryFee?: number;
  minOrder?: number;
  barcode?: string;
  score: number;
};

export type SearchGroup = {
  kind: SearchKind;
  label: string;
  hits: SearchHit[];
};

export type SearchResult = {
  query: string;
  citySlug: string;
  groups: SearchGroup[];
  suggestions: string[];
  total: number;
};

export type SearchInput = {
  query?: string;
  citySlug?: string;
  limit?: number;
};

const GROUP_LIMITS: Record<SearchKind, number> = {
  store: 8,
  product: 12,
  category: 6,
  service: 6,
  delivery: 4,
};

const GROUP_LABELS: Record<SearchKind, string> = {
  store: "Stores",
  product: "Products",
  category: "Categories",
  service: "Services",
  delivery: "Delivery options",
};

/** Arabic and Latin search text is compared without diacritics or case. */
export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u064b-\u065f\u0670]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function allowedDistance(token: string): number {
  if (token.length <= 4) return 0;
  if (token.length <= 7) return 1;
  return 2;
}

/** Small bounded Levenshtein implementation; no dependency required. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const previous = new Array<number>(b.length + 1);
  const current = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) previous[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    let rowMin = current[0];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost,
      );
      rowMin = Math.min(rowMin, current[j]);
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }
  return previous[b.length];
}

function tokenScore(fieldToken: string, queryToken: string): number {
  if (!fieldToken || !queryToken) return 0;
  if (fieldToken === queryToken) return 5;
  if (fieldToken.startsWith(queryToken)) return 4;
  if (fieldToken.includes(queryToken)) return 3;
  // Typos are only considered when the first letter is stable; this stops
  // short unrelated words (water/later) from fuzzy-matching each other.
  if (fieldToken[0] !== queryToken[0]) return 0;
  const distance = editDistance(fieldToken, queryToken, allowedDistance(queryToken));
  if (distance <= allowedDistance(queryToken)) return 2;
  return 0;
}

/**
 * Scores a query against a set of fields. Exact phrases beat prefixes, which
 * beat word matches, which beat one- or two-character typos.
 */
export function matchScore(query: string, fields: Array<string | undefined>): number {
  const needle = normalizeSearchText(query);
  if (!needle) return 0;
  const queryTokens = needle.split(" ").filter(Boolean);
  let best = 0;

  for (const field of fields) {
    if (!field) continue;
    const haystack = normalizeSearchText(field);
    if (!haystack) continue;

    if (haystack === needle) {
      best = Math.max(best, 140);
      continue;
    }
    if (haystack.startsWith(needle)) {
      best = Math.max(best, 120);
      continue;
    }
    if (haystack.includes(` ${needle}`) || haystack.includes(needle)) {
      best = Math.max(best, 95);
      continue;
    }

    const haystackTokens = haystack.split(" ").filter(Boolean);
    let tokenTotal = 0;
    for (const queryToken of queryTokens) {
      let tokenBest = 0;
      for (const haystackToken of haystackTokens) {
        tokenBest = Math.max(tokenBest, tokenScore(haystackToken, queryToken));
      }
      if (!tokenBest) {
        tokenTotal = 0;
        break;
      }
      tokenTotal += tokenBest;
    }
    if (tokenTotal) {
      best = Math.max(best, 45 + (tokenTotal / queryTokens.length) * 9);
    }
  }

  return best;
}

function cityName(city: City | undefined): string {
  return city?.name ?? "";
}

function shortImage(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.startsWith("data:") ? undefined : value;
}

function storeIsOpen(store: Store): boolean {
  return getOpenState(store).open;
}

type ServiceDefinition = {
  id: string;
  title: string;
  subtitle: string;
  keywords: string[];
  href: (citySlug: string) => string;
  enabled: (db: Database, citySlug: string) => boolean;
};

const SERVICES: ServiceDefinition[] = [
  {
    id: "restaurants",
    title: "Restaurants",
    subtitle: "Local kitchens and cafés",
    keywords: ["restaurant", "food", "eat", "delivery", "مطاعم", "أكل"],
    href: (citySlug) => `/city/${citySlug}?category=restaurant`,
    enabled: (db, citySlug) =>
      db.stores.some(
        (store) =>
          store.citySlug === citySlug &&
          (store.category === "restaurant" || store.category === "cafe"),
      ),
  },
  {
    id: "grocery",
    title: "Grocery",
    subtitle: "Supermarkets and daily essentials",
    keywords: ["grocery", "groceries", "supermarket", "market", "بقالة", "سوبرماركت"],
    href: () => "/grocery",
    enabled: (db, citySlug) =>
      db.stores.some(
        (store) => store.citySlug === citySlug && store.category === "grocery",
      ),
  },
  {
    id: "taxi",
    title: "Taxi",
    subtitle: "Cash fare and live route",
    keywords: ["taxi", "ride", "car", "airport", "transport", "طاكسي", "سيارة"],
    href: () => "/taxi",
    enabled: (db, citySlug) =>
      db.drivers.some(
        (driver) =>
          driver.citySlug === citySlug &&
          driver.active &&
          driver.kind !== "delivery",
      ) || citySlug === "dakhla",
  },
  {
    id: "pharmacy",
    title: "Pharmacy",
    subtitle: "Health and personal care",
    keywords: ["pharmacy", "medicine", "health", "صيدلية", "دواء"],
    href: (citySlug) => `/city/${citySlug}?category=pharmacy`,
    enabled: (db, citySlug) =>
      db.stores.some(
        (store) => store.citySlug === citySlug && store.category === "pharmacy",
      ),
  },
  {
    id: "cafes",
    title: "Cafés",
    subtitle: "Coffee, breakfast and something sweet",
    keywords: ["cafe", "coffee", "breakfast", "مقهى", "قهوة"],
    href: (citySlug) => `/city/${citySlug}?category=cafe`,
    enabled: (db, citySlug) =>
      db.stores.some(
        (store) => store.citySlug === citySlug && store.category === "cafe",
      ),
  },
  {
    id: "gifts",
    title: "Gifts",
    subtitle: "Something local, delivered",
    keywords: ["gift", "gifts", "present", "هدية", "هدايا"],
    href: (citySlug) => `/city/${citySlug}?category=gifts`,
    enabled: (db, citySlug) =>
      db.stores.some(
        (store) => store.citySlug === citySlug && store.category === "gifts",
      ),
  },
];

function deliveryOptions(
  db: Database,
  citySlug: string,
): Array<Omit<SearchHit, "score">> {
  const city = db.cities.find((candidate) => candidate.slug === citySlug);
  if (!cityServiceEnabled(city, "grocery")) return [];
  const grocery = db.stores.find(
    (store) => store.citySlug === citySlug && store.category === "grocery",
  );
  if (!grocery) return [];
  const settings = grocery.grocery;
  const items: Array<Omit<SearchHit, "score">> = [
    {
      id: "delivery-pickup",
      kind: "delivery",
      title: "Pickup",
      subtitle: "Collect from the store",
      titleIsKey: true,
      subtitleIsKey: true,
      href: "/grocery?filter=pickup",
      meta: grocery.name,
    },
    {
      id: "delivery-express",
      kind: "delivery",
      title: "Express",
      subtitle: "Fastest available window",
      titleIsKey: true,
      subtitleIsKey: true,
      href: "/grocery?filter=express",
      meta: grocery.name,
    },
  ];
  if (settings?.schedulingEnabled) {
    items.push({
      id: "delivery-scheduled",
      kind: "delivery",
      title: "Scheduled",
      subtitle: "Choose a later delivery window",
      titleIsKey: true,
      subtitleIsKey: true,
      href: "/grocery?filter=all",
      meta: grocery.name,
    });
  }
  return items;
}

function storeCategoryCounts(stores: Store[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const store of stores) {
    counts.set(store.category, (counts.get(store.category) ?? 0) + 1);
  }
  return counts;
}

/**
 * Searches the real platform document. Results never include invented
 * availability, prices or destinations.
 */
export function searchPlatform(db: Database, input: SearchInput): SearchResult {
  const query = (input.query ?? "").trim();
  const citySlug = input.citySlug || "dakhla";
  const limit = Math.max(1, Math.min(input.limit ?? 10, 30));
  const city = db.cities.find((candidate) => candidate.slug === citySlug);
  const cityStores = db.stores.filter((store) => store.citySlug === citySlug);
  const storeById = new Map(db.stores.map((store) => [store.id, store]));
  const empty = !normalizeSearchText(query);

  const stores: SearchHit[] = [];
  for (const store of db.stores) {
    const fields = [
      store.name,
      store.nameAr,
      store.tagline,
      store.description,
      store.landmark,
      store.address,
      categoryLabel(store.category),
      ...(store.tags ?? []),
      ...(store.dietaryTags ?? []),
      db.cities.find((candidate) => candidate.slug === store.citySlug)?.name,
      db.cities.find((candidate) => candidate.slug === store.citySlug)?.nameAr,
    ];
    const base = empty ? (store.citySlug === citySlug ? 50 : 0) : matchScore(query, fields);
    if (!base) continue;
    const local = store.citySlug === citySlug;
    const score =
      base +
      (local ? 35 : 0) +
      (storeIsOpen(store) ? 12 : 0) +
      Math.min(10, store.rating * 2);
    stores.push({
      id: store.id,
      kind: "store",
      title: store.name,
      subtitle: `${categoryLabel(store.category)} · ${store.landmark}`,
      href: `/store/${store.slug}`,
      meta: store.isOpen ? "Open" : "Closed",
      image: shortImage(store.image),
      score,
    });
  }
  stores.sort((a, b) => b.score - a.score);

  const products: SearchHit[] = [];
  for (const product of db.products) {
    const store = storeById.get(product.storeId);
    if (!store) continue;
    const variants = product.variants ?? [];
    const fields = [
      product.name,
      product.description,
      product.brand,
      product.category,
      product.aisle,
      product.sku,
      product.barcode,
      store.name,
      store.nameAr,
      ...variants.flatMap((variant) => [
        variant.label,
        variant.sku,
        variant.barcode,
      ]),
    ];
    const base = empty
      ? product.popular
        ? 45
        : store.citySlug === citySlug
          ? 10
          : 0
      : matchScore(query, fields);
    if (!base) continue;
    const stock = variants.length
      ? variants.reduce((sum, variant) => sum + variant.stock, 0)
      : (product.stock ?? 1);
    const soldOut = !product.available || stock <= 0;
    const score =
      base +
      (store.citySlug === citySlug ? 28 : 0) +
      (product.popular ? 8 : 0) +
      (soldOut ? -40 : 8);
    products.push({
      id: product.id,
      kind: "product",
      title: product.name,
      subtitle: store.name,
      href: `/store/${store.slug}?product=${encodeURIComponent(product.id)}`,
      meta: `${product.price} MAD`,
      image: shortImage(product.image),
      badge: soldOut ? "Sold out" : undefined,
      storeId: store.id,
      storeSlug: store.slug,
      storeName: store.name,
      storeCategory: store.category,
      citySlug: store.citySlug,
      storeLat: store.lat,
      storeLng: store.lng,
      price: product.price,
      unit: product.unit,
      category: product.category,
      stock,
      deliveryFee: store.deliveryFee,
      minOrder: store.minOrder,
      barcode: product.barcode,
      score,
    });
  }
  products.sort((a, b) => b.score - a.score);

  const categories: SearchHit[] = [];
  const counts = storeCategoryCounts(cityStores.length ? cityStores : db.stores);
  for (const [category, count] of counts) {
    const title = categoryLabel(category);
    const base = empty
      ? 30
      : matchScore(query, [title, category]);
    if (!base) continue;
    categories.push({
      id: `category-${category}`,
      kind: "category",
      title,
      subtitle: count === 1 ? "1 store" : `${count} stores`,
      href:
        category === "grocery"
          ? "/grocery"
          : `/city/${citySlug}?category=${category}`,
      meta: String(count),
      score: base + 8,
    });
  }

  const groceryCategories = new Map<string, number>();
  for (const product of db.products) {
    const store = storeById.get(product.storeId);
    if (!store || store.category !== "grocery" || !product.category) continue;
    groceryCategories.set(
      product.category,
      (groceryCategories.get(product.category) ?? 0) + 1,
    );
  }
  for (const [category, count] of groceryCategories) {
    const base = empty ? 12 : matchScore(query, [category]);
    if (!base) continue;
    categories.push({
      id: `aisle-${category}`,
      kind: "category",
      title: category,
      subtitle: "Grocery aisle",
      href: `/grocery?q=${encodeURIComponent(category)}`,
      meta: String(count),
      score: base + 4,
    });
  }
  categories.sort((a, b) => b.score - a.score);

  const services: SearchHit[] = [];
  for (const service of SERVICES) {
    const serviceGate =
      service.id === "grocery"
        ? "grocery"
        : service.id === "taxi"
          ? "taxi"
          : "restaurant";
    if (!cityServiceEnabled(city, serviceGate)) continue;
    if (!service.enabled(db, citySlug)) continue;
    const base = empty ? 24 : matchScore(query, [service.title, ...service.keywords]);
    if (!base) continue;
    services.push({
      id: `service-${service.id}`,
      kind: "service",
      title: service.title,
      subtitle: service.subtitle,
      titleIsKey: true,
      subtitleIsKey: true,
      href: service.href(citySlug),
      meta: city ? cityName(city) : undefined,
      score: base + 10,
    });
  }
  services.sort((a, b) => b.score - a.score);

  const delivery: SearchHit[] = [];
  for (const option of deliveryOptions(db, citySlug)) {
    const base = empty
      ? 8
      : matchScore(query, [
          option.title,
          option.subtitle,
          option.href,
          "delivery",
          "cash",
        ]);
    if (!base) continue;
    delivery.push({ ...option, score: base + 4 });
  }
  delivery.sort((a, b) => b.score - a.score);

  const grouped: Array<[SearchKind, SearchHit[]]> = [
    ["store", stores],
    ["product", products],
    ["category", categories],
    ["service", services],
    ["delivery", delivery],
  ];

  const groups: SearchGroup[] = grouped
    .filter(([, hits]) => hits.length > 0)
    .map(([kind, hits]) => ({
      kind,
      label: GROUP_LABELS[kind],
      hits: hits.slice(0, Math.min(GROUP_LIMITS[kind], limit)),
    }));

  const suggestions = Array.from(
    new Set(
      [
        ...stores.map((hit) => hit.title),
        ...products.map((hit) => hit.title),
        ...categories.map((hit) => hit.title),
        ...services.map((hit) => hit.title),
      ]
        .filter((value) => value.trim().length > 1)
        .slice(0, 24),
    ),
  ).slice(0, 6);

  return {
    query,
    citySlug,
    groups,
    suggestions,
    total: groups.reduce((sum, group) => sum + group.hits.length, 0),
  };
}
