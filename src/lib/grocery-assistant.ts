import { getOpenState } from "./hours";
import { normalizeSearchText, matchScore } from "./search";
import type { Order, Product, Store } from "./types";

export type AssistantTerm = {
  label: string;
  query: string;
  qty: number;
};

export type AssistantRecipe = {
  id: string;
  keywords: string[];
  titleKey: string;
  summaryKey: string;
  terms: AssistantTerm[];
};

export type AssistantItem = {
  label: string;
  product: Product;
  store: Store;
  qty: number;
  reason: "recipe" | "cheapest" | "usual" | "popular" | "search";
};

export type AssistantPlan = {
  intent: string;
  titleKey: string;
  summaryKey: string;
  titleVars: Record<string, string | number>;
  items: AssistantItem[];
  missing: string[];
  estimatedTotal: number;
  storeCount: number;
  citySlug: string;
};

export const ASSISTANT_RECIPES: AssistantRecipe[] = [
  {
    id: "couscous",
    keywords: ["couscous", "كسكس", "كوسكوس"],
    titleKey: "Couscous night",
    summaryKey: "A complete ingredient list for a family couscous.",
    terms: [
      { label: "Couscous", query: "couscous", qty: 1 },
      { label: "Chicken", query: "chicken", qty: 1 },
      { label: "Carrots", query: "carrot", qty: 1 },
      { label: "Onions", query: "onion", qty: 1 },
      { label: "Chickpeas", query: "chickpea", qty: 1 },
      { label: "Olive oil", query: "olive oil", qty: 1 },
    ],
  },
  {
    id: "cleaning",
    keywords: ["cleaning", "clean", "household", "nettoyage", "limpieza", "تنظيف"],
    titleKey: "Household cleaning basket",
    summaryKey: "Everyday cleaning essentials for the home.",
    terms: [
      { label: "Surface cleaner", query: "cleaner", qty: 1 },
      { label: "Bleach", query: "bleach", qty: 1 },
      { label: "Dish soap", query: "dish soap", qty: 1 },
      { label: "Sponges", query: "sponge", qty: 1 },
      { label: "Rubber gloves", query: "gloves", qty: 1 },
      { label: "Trash bags", query: "trash bag", qty: 1 },
    ],
  },
  {
    id: "baby",
    keywords: ["baby", "infant", "bébé", "bebe", "طفل", "أطفال"],
    titleKey: "Baby essentials",
    summaryKey: "Nappies, wipes and feeding basics.",
    terms: [
      { label: "Nappies", query: "diaper", qty: 1 },
      { label: "Baby wipes", query: "wipes", qty: 1 },
      { label: "Baby formula", query: "formula", qty: 1 },
      { label: "Baby cereal", query: "baby cereal", qty: 1 },
    ],
  },
  {
    id: "breakfast",
    keywords: ["breakfast", "petit déjeuner", "desayuno", "فطور"],
    titleKey: "Breakfast table",
    summaryKey: "Bread, eggs, milk, coffee and something sweet.",
    terms: [
      { label: "Bread", query: "bread", qty: 1 },
      { label: "Eggs", query: "egg", qty: 1 },
      { label: "Milk", query: "milk", qty: 1 },
      { label: "Coffee", query: "coffee", qty: 1 },
      { label: "Butter", query: "butter", qty: 1 },
      { label: "Honey", query: "honey", qty: 1 },
    ],
  },
  {
    id: "tea",
    keywords: ["tea", "thé", "té", "شاي"],
    titleKey: "Tea time",
    summaryKey: "Mint tea, sugar and a little something to share.",
    terms: [
      { label: "Green tea", query: "green tea", qty: 1 },
      { label: "Mint", query: "mint", qty: 1 },
      { label: "Sugar", query: "sugar", qty: 1 },
      { label: "Biscuits", query: "biscuit", qty: 1 },
    ],
  },
  {
    id: "pasta",
    keywords: ["pasta", "spaghetti", "pâtes", "pates", "معكرونة"],
    titleKey: "Pasta night",
    summaryKey: "Pasta, tomato, vegetables and cheese.",
    terms: [
      { label: "Pasta", query: "pasta", qty: 1 },
      { label: "Tomato", query: "tomato", qty: 1 },
      { label: "Onion", query: "onion", qty: 1 },
      { label: "Cheese", query: "cheese", qty: 1 },
      { label: "Olive oil", query: "olive oil", qty: 1 },
    ],
  },
  {
    id: "salad",
    keywords: ["salad", "salade", "ensalada", "سلطة"],
    titleKey: "Fresh salad",
    summaryKey: "Greens, tomato, cucumber and a simple dressing.",
    terms: [
      { label: "Lettuce", query: "lettuce", qty: 1 },
      { label: "Tomato", query: "tomato", qty: 1 },
      { label: "Cucumber", query: "cucumber", qty: 1 },
      { label: "Onion", query: "onion", qty: 1 },
      { label: "Olive oil", query: "olive oil", qty: 1 },
    ],
  },
  {
    id: "weekly",
    keywords: ["weekly", "usual", "staples", "hebdomadaire", "semanal", "أسبوعي"],
    titleKey: "Weekly essentials",
    summaryKey: "The everyday groceries most households restock.",
    terms: [
      { label: "Bread", query: "bread", qty: 1 },
      { label: "Milk", query: "milk", qty: 1 },
      { label: "Eggs", query: "egg", qty: 1 },
      { label: "Rice", query: "rice", qty: 1 },
      { label: "Oil", query: "oil", qty: 1 },
      { label: "Water", query: "water", qty: 1 },
      { label: "Tomatoes", query: "tomato", qty: 1 },
      { label: "Fruit", query: "fruit", qty: 1 },
    ],
  },
];

const STOPWORDS = new Set([
  "find",
  "get",
  "build",
  "prepare",
  "make",
  "my",
  "the",
  "for",
  "a",
  "an",
  "some",
  "cheapest",
  "cheap",
  "best",
  "please",
  "i",
  "want",
  "need",
  "me",
  "basket",
  "list",
  "groceries",
  "grocery",
  "shopping",
  "ingredients",
  "essentials",
  "not",
  "no",
  "with",
  "without",
  "of",
  "and",
  "or",
  "to",
  "in",
  "on",
  "product",
  "products",
]);

type Match = {
  product: Product;
  store: Store;
  score: number;
};

function availableStock(product: Product): number {
  if (product.variants?.length) {
    return product.variants.reduce((sum, variant) => sum + variant.stock, 0);
  }
  return product.stock ?? 1;
}

function productScore(product: Product, store: Store, term: string): number {
  return matchScore(term, [
    product.name,
    product.brand,
    product.category,
    product.aisle,
    store.name,
  ]);
}

function bestMatch(
  term: string,
  products: Product[],
  stores: Map<string, Store>,
  now: Date,
  cheapest: boolean,
): Match | null {
  let matches: Match[] = [];
  const searchTerms = [
    term,
    ...normalizeSearchText(term)
      .split(" ")
      .filter((token) => token.length > 2),
  ];
  for (const searchTerm of searchTerms) {
    const fallback = searchTerm !== term;
    for (const product of products) {
      const store = stores.get(product.storeId);
      if (!store || !product.available || availableStock(product) <= 0) continue;
      const score = productScore(product, store, searchTerm);
      if (score <= 0) continue;
      if (fallback && score < 80) continue;
      if (matches.some((match) => match.product.id === product.id)) continue;
      matches.push({ product, store, score });
    }
    if (matches.length) break;
  }
  if (!matches.length) return null;
  matches.sort((a, b) => {
    if (cheapest) return a.product.price - b.product.price || b.score - a.score;
    const openA = getOpenState(a.store, now).open ? 1 : 0;
    const openB = getOpenState(b.store, now).open ? 1 : 0;
    return (
      openB - openA ||
      b.score - a.score ||
      Number(Boolean(b.product.popular)) - Number(Boolean(a.product.popular)) ||
      a.product.price - b.product.price
    );
  });
  return matches[0];
}

function hasKeyword(normalized: string, keyword: string, raw: string): boolean {
  const value = normalizeSearchText(keyword);
  if (!value) return false;
  if (value.length <= 3) {
    // Short keywords are checked against the raw text too, so the accent in
    // "thé" does not turn into the English stopword "the".
    return (
      ` ${normalized} `.includes(` ${value} `) &&
      raw.includes(keyword.toLowerCase())
    );
  }
  return normalized.includes(value);
}

export function interpretGroceryRequest(
  query: string,
  recipes: AssistantRecipe[] = ASSISTANT_RECIPES,
): { recipe?: AssistantRecipe; cheapest: boolean; customTerm?: string } {
  const normalized = normalizeSearchText(query);
  const cheapest = /\bcheapest\b|\bcheap\b|\bmoins cher\b|\bأرخص\b/.test(normalized);
  const raw = query.toLowerCase();
  const recipe = recipes.find((entry) =>
    entry.keywords.some((keyword) => hasKeyword(normalized, keyword, raw)),
  );
  if (recipe) return { recipe, cheapest };
  const custom = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token))
    .slice(0, 3)
    .join(" ");
  return { cheapest, customTerm: custom || normalized };
}

export function buildAssistantPlan(input: {
  query: string;
  citySlug: string;
  stores: Store[];
  products: Product[];
  orders?: Order[];
  now?: Date;
}): AssistantPlan {
  const now = input.now ?? new Date();
  const groceryStores = input.stores.filter(
    (store) => store.category === "grocery" && store.citySlug === input.citySlug,
  );
  const storeMap = new Map(groceryStores.map((store) => [store.id, store]));
  const storeIds = new Set(groceryStores.map((store) => store.id));
  const products = input.products.filter((product) => storeIds.has(product.storeId));
  const interpretation = interpretGroceryRequest(input.query);
  const items: AssistantItem[] = [];
  const missing: string[] = [];
  const used = new Set<string>();

  function push(item: AssistantItem | null) {
    if (!item) return;
    if (used.has(item.product.id)) return;
    used.add(item.product.id);
    items.push(item);
  }

  if (interpretation.recipe?.id === "weekly" || !interpretation.recipe) {
    // A signed-in customer's usual products win over generic staples.
    const usual = (input.orders ?? [])
      .slice(0, 3)
      .flatMap((order) => order.items)
      .filter((line, index, all) => all.findIndex((item) => item.productId === line.productId) === index)
      .slice(0, 8);
    for (const line of usual) {
      const product = products.find((item) => item.id === line.productId);
      const store = product ? storeMap.get(product.storeId) : undefined;
      if (!product || !store || !product.available || availableStock(product) <= 0) continue;
      push({
        label: line.name,
        product,
        store,
        qty: Math.max(1, Math.min(5, line.qty)),
        reason: "usual",
      });
    }
  }

  const recipe = interpretation.recipe;
  const terms: AssistantTerm[] = recipe
    ? recipe.terms
    : [
        {
          label: interpretation.customTerm || input.query,
          query: interpretation.customTerm || input.query,
          qty: 1,
        },
      ];

  for (const term of terms) {
    const match = bestMatch(term.query, products, storeMap, now, interpretation.cheapest);
    if (!match) {
      missing.push(term.label);
      continue;
    }
    push({
      label: term.label,
      product: match.product,
      store: match.store,
      qty: term.qty,
      reason: interpretation.cheapest
        ? "cheapest"
        : recipe?.id === "weekly"
          ? "usual"
          : recipe
            ? "recipe"
            : "search",
    });
  }

  return {
    intent: recipe?.id ?? (interpretation.cheapest ? "cheapest" : "search"),
    titleKey: recipe?.titleKey ?? "Shopping plan for “{query}”",
    summaryKey:
      recipe?.summaryKey ??
      (interpretation.cheapest
        ? "The lowest-priced matches we can find in your city."
        : "Editable product matches based on your request."),
    titleVars: { query: input.query },
    items,
    missing,
    estimatedTotal: items.reduce(
      (sum, item) => sum + item.product.price * item.qty,
      0,
    ),
    storeCount: new Set(items.map((item) => item.store.id)).size,
    citySlug: input.citySlug,
  };
}
