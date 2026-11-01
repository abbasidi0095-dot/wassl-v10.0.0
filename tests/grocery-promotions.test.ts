import { describe, expect, it } from "vitest";
import {
  DEFAULT_GROCERY_PROMOTIONS,
  applyGroceryPromotions,
  promotionForProduct,
} from "@/lib/grocery-promotions";
import type { Product } from "@/lib/types";

const now = new Date("2026-11-01T12:00:00Z");

function product(id: string, price: number, category = "Fresh"): Product {
  return {
    id,
    storeId: "store_sahara_market",
    category,
    name: id,
    description: "",
    price,
    emoji: "",
    available: true,
  };
}

describe("grocery promotions", () => {
  it("applies a flash discount to a matching product", () => {
    const result = applyGroceryPromotions({
      items: [{ product: product("product_017", 24, "Drinks"), qty: 1 }],
      subtotal: 24,
      storeId: "store_sahara_market",
      promotions: DEFAULT_GROCERY_PROMOTIONS,
      now,
    });
    expect(result.discount).toBe(2);
    expect(result.applied[0].id).toBe("promo_water_flash");
  });

  it("applies quantity discounts only at the threshold", () => {
    const items = [{ product: product("product_048", 16), qty: 2 }];
    const below = applyGroceryPromotions({
      items,
      subtotal: 32,
      storeId: "store_sahara_market",
      promotions: DEFAULT_GROCERY_PROMOTIONS,
      now,
    });
    expect(below.discount).toBe(0);

    const at = applyGroceryPromotions({
      items: [{ product: product("product_048", 16), qty: 3 }],
      subtotal: 48,
      storeId: "store_sahara_market",
      promotions: DEFAULT_GROCERY_PROMOTIONS,
      now,
    });
    expect(at.discount).toBe(7);
    expect(at.applied[0].id).toBe("promo_apples_quantity");
  });

  it("applies store-wide promotions after line discounts", () => {
    const result = applyGroceryPromotions({
      items: [{ product: product("product_013", 9), qty: 12 }],
      subtotal: 108,
      storeId: "store_sahara_market",
      promotions: DEFAULT_GROCERY_PROMOTIONS,
      now,
    });
    expect(result.discount).toBe(5);
    expect(result.applied.some((entry) => entry.id === "promo_sahara_store")).toBe(true);
  });

  it("never discounts a product outside the store", () => {
    const result = applyGroceryPromotions({
      items: [{ product: product("product_017", 24, "Drinks"), qty: 1 }],
      subtotal: 24,
      storeId: "store_boujdour_fresh",
      promotions: DEFAULT_GROCERY_PROMOTIONS,
      now,
    });
    expect(result.discount).toBe(0);
  });

  it("exposes a product badge only for active matching offers", () => {
    expect(
      promotionForProduct(
        product("product_017", 24, "Drinks"),
        DEFAULT_GROCERY_PROMOTIONS,
        "store_sahara_market",
        now,
      )?.percentOff,
    ).toBe(10);
    expect(
      promotionForProduct(
        product("product_017", 24, "Drinks"),
        DEFAULT_GROCERY_PROMOTIONS,
        "store_sahara_market",
        new Date("2030-01-01T00:00:00Z"),
      ),
    ).toBeUndefined();
  });
});
