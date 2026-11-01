import type { GroceryPromotion, Product } from "./types";

/** Seed promotions cover flash, quantity, bulk and store-wide offers. */
export const DEFAULT_GROCERY_PROMOTIONS: GroceryPromotion[] = [
  {
    id: "promo_water_flash",
    title: "Flash: 10% off Water 6 × 1.5L",
    kind: "flash",
    storeId: "store_sahara_market",
    productIds: ["product_017"],
    percentOff: 10,
    minQty: 1,
    startsAt: "2026-10-01T00:00:00.000Z",
    endsAt: "2027-12-31T23:59:59.000Z",
    active: true,
  },
  {
    id: "promo_apples_quantity",
    title: "3+ apples: 15% off",
    kind: "quantity",
    storeId: "store_sahara_market",
    productIds: ["product_048"],
    percentOff: 15,
    minQty: 3,
    startsAt: "2026-10-01T00:00:00.000Z",
    endsAt: "2027-12-31T23:59:59.000Z",
    active: true,
  },
  {
    id: "promo_rice_bulk",
    title: "Buy 5 rice: 10% off",
    kind: "bulk",
    storeId: "store_sahara_market",
    productIds: ["product_050"],
    percentOff: 10,
    minQty: 5,
    startsAt: "2026-10-01T00:00:00.000Z",
    endsAt: "2027-12-31T23:59:59.000Z",
    active: true,
  },
  {
    id: "promo_sahara_store",
    title: "Sahara Market: 5% off baskets over 100 MAD",
    kind: "flash",
    storeId: "store_sahara_market",
    percentOff: 5,
    minQty: 1,
    minSubtotal: 100,
    startsAt: "2026-10-01T00:00:00.000Z",
    endsAt: "2027-12-31T23:59:59.000Z",
    active: true,
  },
  {
    id: "promo_boujdour_fresh",
    title: "Boujdour Fresh: 10% off fresh produce",
    kind: "flash",
    storeId: "store_boujdour_fresh",
    categories: ["Fresh"],
    percentOff: 10,
    minQty: 2,
    startsAt: "2026-10-01T00:00:00.000Z",
    endsAt: "2027-12-31T23:59:59.000Z",
    active: true,
  },
];

function active(promotion: GroceryPromotion, now: Date): boolean {
  if (!promotion.active) return false;
  const start = new Date(promotion.startsAt).getTime();
  const end = new Date(promotion.endsAt).getTime();
  const time = now.getTime();
  return Number.isFinite(start) && Number.isFinite(end) && time >= start && time <= end;
}

export function activeGroceryPromotions(
  promotions: GroceryPromotion[],
  storeId: string,
  now = new Date(),
): GroceryPromotion[] {
  return promotions.filter(
    (promotion) =>
      active(promotion, now) &&
      (!promotion.storeId || promotion.storeId === storeId),
  );
}

function matchesProduct(promotion: GroceryPromotion, product: Product): boolean {
  if (promotion.productIds?.length) return promotion.productIds.includes(product.id);
  if (promotion.categories?.length) {
    return promotion.categories.some(
      (category) => category.toLowerCase() === product.category.toLowerCase(),
    );
  }
  return false;
}

/** Best per-product badge, independent of quantity. */
export function promotionForProduct(
  product: Product,
  promotions: GroceryPromotion[],
  storeId: string,
  now = new Date(),
): GroceryPromotion | undefined {
  return activeGroceryPromotions(promotions, storeId, now)
    .filter((promotion) => matchesProduct(promotion, product))
    .sort((a, b) => b.percentOff - a.percentOff)[0];
}

export type PromotionApplication = {
  discount: number;
  applied: Array<{ id: string; title: string; amount: number }>;
};

/** Server-side line and basket promotion calculation. */
export function applyGroceryPromotions(input: {
  items: Array<{ product: Product; qty: number }>;
  subtotal: number;
  storeId: string;
  promotions: GroceryPromotion[];
  now?: Date;
}): PromotionApplication {
  const now = input.now ?? new Date();
  const activePromotions = activeGroceryPromotions(
    input.promotions,
    input.storeId,
    now,
  );
  let lineDiscount = 0;
  const applied: PromotionApplication["applied"] = [];

  for (const line of input.items) {
    const candidates = activePromotions
      .filter(
        (promotion) =>
          matchesProduct(promotion, line.product) &&
          line.qty >= promotion.minQty,
      )
      .sort((a, b) => b.percentOff - a.percentOff);
    const promotion = candidates[0];
    if (!promotion) continue;
    const amount = Math.round((line.product.price * line.qty * promotion.percentOff) / 100);
    if (amount <= 0) continue;
    lineDiscount += amount;
    applied.push({ id: promotion.id, title: promotion.title, amount });
  }

  const remaining = Math.max(0, input.subtotal - lineDiscount);
  const storeWide = activePromotions
    .filter(
      (promotion) =>
        !promotion.productIds?.length &&
        !promotion.categories?.length &&
        remaining >= (promotion.minSubtotal ?? 0) &&
        promotion.percentOff > 0,
    )
    .sort((a, b) => b.percentOff - a.percentOff)[0];
  if (storeWide) {
    const amount = Math.round((remaining * storeWide.percentOff) / 100);
    if (amount > 0) {
      lineDiscount += amount;
      applied.push({ id: storeWide.id, title: storeWide.title, amount });
    }
  }

  return {
    discount: Math.min(input.subtotal, lineDiscount),
    applied,
  };
}
