import { describe, expect, it } from "vitest";
import { computeAnalytics } from "@/lib/analytics";
import { normalizeServiceCommissions } from "@/lib/commissions";
import type { Order, Store, TaxiRide } from "@/lib/types";

const stores = [
  { id: "store_food", name: "Food", citySlug: "dakhla", category: "restaurant" },
  { id: "store_grocery", name: "Grocery", citySlug: "dakhla", category: "grocery" },
] as Store[];

function order(overrides: Partial<Order>): Order {
  return {
    id: "order_1",
    code: "WSL-1",
    citySlug: "dakhla",
    storeId: "store_food",
    status: "delivered",
    customerName: "Test",
    customerPhone: "0",
    address: "A",
    landmark: "B",
    lat: 0,
    lng: 0,
    items: [],
    subtotal: 50,
    deliveryFee: 5,
    total: 55,
    paymentMethod: "cod",
    createdAt: "2026-10-31T10:00:00.000Z",
    updatedAt: "2026-10-31T10:00:00.000Z",
    deliveredAt: "2026-10-31T10:30:00.000Z",
    events: [],
    ...overrides,
  } as Order;
}

const ride = {
  id: "ride_1",
  status: "completed",
  fare: 25,
  completedAt: "2026-10-31T11:00:00.000Z",
  createdAt: "2026-10-31T10:50:00.000Z",
  updatedAt: "2026-10-31T11:00:00.000Z",
  pickupLabel: "A",
  dropoffLabel: "B",
  citySlug: "dakhla",
} as TaxiRide;

describe("admin analytics profit", () => {
  it("applies 5 MAD delivery, 2 MAD taxi and 5% grocery", () => {
    const analytics = computeAnalytics(
      [
        order({ id: "order_food" }),
        order({
          id: "order_grocery",
          storeId: "store_grocery",
          subtotal: 100,
          total: 110,
        }),
      ],
      [ride],
      stores,
      [{ role: "customer" }, { role: "driver" }],
    );
    expect(analytics.profit.food).toBe(5);
    expect(analytics.profit.taxi).toBe(2);
    expect(analytics.profit.grocery).toBe(10);
    expect(analytics.profit.pharmacy).toBe(0);
    expect(analytics.profit.total).toBe(17);
    expect(analytics.services.food.jobs).toBe(1);
    expect(analytics.services.grocery.base).toBe(100);
    expect(analytics.services.grocery.fixed).toBe(5);
    expect(analytics.signups.drivers).toBe(1);
  });

  it("applies custom per-service fixed fees and rates", () => {
    const commissions = normalizeServiceCommissions({
      food: { fixedFee: 3, rate: 2 },
      grocery: { fixedFee: 0, rate: 10 },
      pharmacy: { fixedFee: 1, rate: 8 },
      taxi: { fixedFee: 1, rate: 4 },
    });
    const analytics = computeAnalytics(
      [
        order({ id: "order_food" }),
        order({
          id: "order_grocery",
          storeId: "store_grocery",
          subtotal: 100,
          total: 110,
        }),
      ],
      [ride],
      stores,
      [{ role: "customer" }],
      commissions,
    );
    // Food: 3 MAD fixed + 2% of 50 = 4.
    expect(analytics.profit.food).toBe(4);
    // Grocery: 10% of 100 goods, no fixed fee in this override.
    expect(analytics.profit.grocery).toBe(10);
    // Taxi: 1 MAD fixed + 4% of 25 = 2.
    expect(analytics.profit.taxi).toBe(2);
    expect(analytics.profit.total).toBe(16);
    expect(analytics.services.food.percent).toBe(1);
  });

  it("clamps commission values to safe limits", () => {
    const commissions = normalizeServiceCommissions({
      food: { fixedFee: 999, rate: -4 },
      taxi: { fixedFee: -2, rate: 200 },
    });
    expect(commissions.food.fixedFee).toBe(100);
    expect(commissions.food.rate).toBe(0);
    expect(commissions.taxi.fixedFee).toBe(0);
    expect(commissions.taxi.rate).toBe(40);
  });
});
