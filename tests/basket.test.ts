import { describe, expect, it } from "vitest";
import {
  addBasketLine,
  basketTotals,
  groupBasket,
  hasMixedCities,
  nextRecurringDate,
  parseBasket,
  setBasketQty,
  setGroupSubstitution,
  type BasketLine,
} from "@/lib/basket";

function line(overrides: Partial<BasketLine> = {}): BasketLine {
  return {
    productId: "product_1",
    storeId: "store_1",
    storeSlug: "store-one",
    storeName: "Store One",
    storeCategory: "grocery",
    citySlug: "dakhla",
    storeLat: 23.68,
    storeLng: -15.95,
    name: "Water",
    price: 10,
    qty: 1,
    stock: 20,
    deliveryFee: 8,
    minOrder: 30,
    substitution: "allow",
    ...overrides,
  };
}

describe("Wassl Basket", () => {
  it("groups lines by store and adds each store's delivery fee once", () => {
    const groups = groupBasket([
      line({ productId: "a", price: 10, qty: 2 }),
      line({ productId: "b", price: 5, qty: 1 }),
      line({
        productId: "c",
        storeId: "store_2",
        storeSlug: "store-two",
        storeName: "Store Two",
        price: 20,
        qty: 1,
        deliveryFee: 12,
        minOrder: 15,
      }),
    ]);

    expect(groups).toHaveLength(2);
    const one = groups.find((group) => group.storeId === "store_1")!;
    expect(one.subtotal).toBe(25);
    expect(one.total).toBe(33);
    expect(one.meetsMinimum).toBe(false);

    const totals = basketTotals(groups);
    expect(totals.subtotal).toBe(45);
    expect(totals.delivery).toBe(20);
    expect(totals.total).toBe(65);
    expect(totals.belowMinimum).toBe(true);
  });

  it("merges duplicate lines and respects stock caps", () => {
    const first = addBasketLine([], line({ stock: 2 }), 1);
    const second = addBasketLine(first, line({ stock: 2 }), 5);
    expect(second).toHaveLength(1);
    expect(second[0].qty).toBe(2);
  });

  it("rejects malformed stored lines", () => {
    const parsed = parseBasket([
      { productId: "ok", storeId: "s", storeSlug: "s", storeName: "S", citySlug: "dakhla", name: "Tea", price: 4, qty: 2, stock: 5 },
      { productId: "", price: 0 },
      null,
      "bad",
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].qty).toBe(2);
  });

  it("updates quantity and substitutions without losing other stores", () => {
    const lines = [
      line({ productId: "a" }),
      line({ productId: "b", storeId: "store_2", storeSlug: "store-two", storeName: "Store Two" }),
    ];
    expect(setBasketQty(lines, "a", 3)[0].qty).toBe(3);
    expect(setBasketQty(lines, "a", 0)).toHaveLength(1);
    expect(setGroupSubstitution(lines, "store_2", "refund")[1].substitution).toBe("refund");
  });

  it("detects mixed cities", () => {
    expect(hasMixedCities([line(), line({ productId: "b", citySlug: "laayoune" })])).toBe(true);
    expect(hasMixedCities([line()])).toBe(false);
  });

  it("computes weekly and monthly recurring dates", () => {
    const from = new Date("2026-11-01T10:00:00.000Z");
    expect(nextRecurringDate("weekly", from)).toBe("2026-11-08T10:00:00.000Z");
    expect(nextRecurringDate("monthly", from)).toBe("2026-12-01T10:00:00.000Z");
  });
});
