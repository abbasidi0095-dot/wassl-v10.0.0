import { describe, expect, it } from "vitest";
import { computeAnalytics } from "@/lib/analytics";
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
    expect(analytics.profit.delivery).toBe(10);
    expect(analytics.profit.taxi).toBe(2);
    expect(analytics.profit.grocery).toBe(5);
    expect(analytics.profit.total).toBe(17);
    expect(analytics.signups.drivers).toBe(1);
  });
});
