import type { RecurringFrequency, StoreCategory } from "./types";

export type BasketSubstitution = "allow" | "refund" | "contact";

export type BasketLine = {
  productId: string;
  storeId: string;
  storeSlug: string;
  storeName: string;
  storeCategory: StoreCategory;
  citySlug: string;
  storeLat: number;
  storeLng: number;
  name: string;
  image?: string;
  price: number;
  unit?: string;
  qty: number;
  stock: number;
  deliveryFee: number;
  minOrder: number;
  substitution: BasketSubstitution;
  barcode?: string;
};

export type BasketGroup = {
  storeId: string;
  storeSlug: string;
  storeName: string;
  citySlug: string;
  deliveryFee: number;
  minOrder: number;
  lines: BasketLine[];
  itemCount: number;
  subtotal: number;
  total: number;
  meetsMinimum: boolean;
  substitution: BasketSubstitution;
};

export type BasketTotals = {
  itemCount: number;
  lineCount: number;
  storeCount: number;
  subtotal: number;
  delivery: number;
  total: number;
  belowMinimum: boolean;
};

const SUBSTITUTIONS = new Set<BasketSubstitution>(["allow", "refund", "contact"]);

function finite(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Parse a basket from local storage without trusting its shape. */
export function parseBasket(value: unknown): BasketLine[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): BasketLine | null => {
      if (!entry || typeof entry !== "object") return null;
      const line = entry as Record<string, unknown>;
      const productId = typeof line.productId === "string" ? line.productId : "";
      const storeId = typeof line.storeId === "string" ? line.storeId : "";
      const storeSlug = typeof line.storeSlug === "string" ? line.storeSlug : "";
      const storeName = typeof line.storeName === "string" ? line.storeName : "";
      const citySlug = typeof line.citySlug === "string" ? line.citySlug : "";
      const name = typeof line.name === "string" ? line.name : "";
      const price = finite(line.price);
      if (!productId || !storeId || !storeSlug || !storeName || !citySlug || !name) {
        return null;
      }
      if (price <= 0) return null;
      const substitution = SUBSTITUTIONS.has(line.substitution as BasketSubstitution)
        ? (line.substitution as BasketSubstitution)
        : "allow";
      return {
        productId,
        storeId,
        storeSlug,
        storeName,
        storeCategory:
          line.storeCategory === "grocery" ? "grocery" : "grocery",
        citySlug,
        storeLat: finite(line.storeLat, 0),
        storeLng: finite(line.storeLng, 0),
        name,
        image: typeof line.image === "string" ? line.image : undefined,
        price,
        unit: typeof line.unit === "string" ? line.unit : undefined,
        qty: Math.max(1, Math.min(20, Math.round(finite(line.qty, 1)))),
        stock: Math.max(0, Math.round(finite(line.stock, 0))),
        deliveryFee: Math.max(0, Math.round(finite(line.deliveryFee))),
        minOrder: Math.max(0, Math.round(finite(line.minOrder))),
        substitution,
        barcode: typeof line.barcode === "string" ? line.barcode : undefined,
      };
    })
    .filter((line): line is BasketLine => Boolean(line))
    .slice(0, 60);
}

export function groupBasket(lines: BasketLine[]): BasketGroup[] {
  const groups = new Map<string, BasketGroup>();
  for (const line of lines) {
    let group = groups.get(line.storeId);
    if (!group) {
      group = {
        storeId: line.storeId,
        storeSlug: line.storeSlug,
        storeName: line.storeName,
        citySlug: line.citySlug,
        deliveryFee: line.deliveryFee,
        minOrder: line.minOrder,
        lines: [],
        itemCount: 0,
        subtotal: 0,
        total: 0,
        meetsMinimum: true,
        substitution: line.substitution,
      };
      groups.set(line.storeId, group);
    }
    group.lines.push(line);
    group.itemCount += line.qty;
    group.subtotal += line.price * line.qty;
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      total: group.subtotal + group.deliveryFee,
      meetsMinimum: group.subtotal >= group.minOrder,
    }))
    .sort((a, b) => a.storeName.localeCompare(b.storeName));
}

export function basketTotals(groups: BasketGroup[]): BasketTotals {
  const subtotal = groups.reduce((sum, group) => sum + group.subtotal, 0);
  const delivery = groups.reduce((sum, group) => sum + group.deliveryFee, 0);
  return {
    itemCount: groups.reduce((sum, group) => sum + group.itemCount, 0),
    lineCount: groups.reduce((sum, group) => sum + group.lines.length, 0),
    storeCount: groups.length,
    subtotal,
    delivery,
    total: subtotal + delivery,
    belowMinimum: groups.some((group) => !group.meetsMinimum),
  };
}

export function addBasketLine(
  lines: BasketLine[],
  line: Omit<BasketLine, "qty">,
  qty = 1,
): BasketLine[] {
  const existing = lines.find(
    (entry) => entry.productId === line.productId && entry.storeId === line.storeId,
  );
  if (existing) {
    return lines.map((entry) =>
      entry === existing
        ? { ...entry, qty: Math.min(20, entry.stock || 20, entry.qty + qty) }
        : entry,
    );
  }
  return [
    ...lines,
    {
      ...line,
      qty: Math.max(1, Math.min(20, line.stock || 20, qty)),
    },
  ].slice(0, 60);
}

export function setBasketQty(
  lines: BasketLine[],
  productId: string,
  qty: number,
): BasketLine[] {
  if (qty <= 0) return lines.filter((line) => line.productId !== productId);
  return lines.map((line) =>
    line.productId === productId
      ? { ...line, qty: Math.min(20, line.stock || 20, Math.max(1, qty)) }
      : line,
  );
}

export function setGroupSubstitution(
  lines: BasketLine[],
  storeId: string,
  substitution: BasketSubstitution,
): BasketLine[] {
  return lines.map((line) =>
    line.storeId === storeId ? { ...line, substitution } : line,
  );
}

export function basketCity(lines: BasketLine[]): string | null {
  if (!lines.length) return null;
  return lines[0].citySlug;
}

export function hasMixedCities(lines: BasketLine[]): boolean {
  const city = basketCity(lines);
  return Boolean(city && lines.some((line) => line.citySlug !== city));
}


/** Next reminder date. Recurring baskets never create orders automatically. */
export function nextRecurringDate(
  frequency: RecurringFrequency,
  from = new Date(),
): string {
  const next = new Date(from.getTime());
  if (frequency === "weekly") {
    next.setDate(next.getDate() + 7);
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  return next.toISOString();
}
