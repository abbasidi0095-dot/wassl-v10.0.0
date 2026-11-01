import { describe, expect, it } from "vitest";
import { createSeedDatabase } from "@/lib/seed";
import { inventoryIntelligence } from "@/lib/inventory";

describe("grocery inventory intelligence", () => {
  const db = createSeedDatabase();

  it("summarises real grocery stock and sales", () => {
    const report = inventoryIntelligence({
      stores: db.stores,
      products: db.products,
      orders: db.orders,
      reservations: [],
      now: new Date(),
      days: 14,
    });
    expect(report.skuCount).toBeGreaterThan(0);
    expect(report.inventoryValue).toBeGreaterThan(0);
    expect(report.topSellers.length).toBeGreaterThan(0);
    expect(report.soldQty).toBeGreaterThan(0);
  });

  it("suggests replenishment for low stock and fast sellers", () => {
    const report = inventoryIntelligence({
      stores: db.stores,
      products: db.products,
      orders: db.orders,
      reservations: [],
      now: new Date(),
      days: 14,
    });
    expect(report.restock.length).toBeGreaterThan(0);
    expect(report.restock[0].suggestedRestock).toBeGreaterThan(0);
  });

  it("lists slow movers with stock and keeps history bounded", () => {
    const reservation = {
      id: "stock_test",
      orderId: "order_test",
      productId: "product_017",
      qty: 2,
      status: "reserved" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const report = inventoryIntelligence({
      stores: db.stores,
      products: db.products,
      orders: db.orders,
      reservations: [reservation],
      now: new Date(),
      days: 14,
    });
    expect(report.slowCount).toBeGreaterThan(0);
    expect(report.history[0]?.productName).toBeTruthy();
    expect(report.history).toHaveLength(1);
  });
});
