import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OrderActor } from "@/lib/order-machine";
import type { Store } from "@/lib/types";
import {
  defaultGrocerySettings,
  groceryAvailability,
  groceryFees,
  resolveProductStock,
  stockBadge,
} from "@/lib/grocery";

let dataDir: string;

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "wassl-grocery-"));
  process.env.WASSL_DATA_DIR = dataDir;
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

const baseStore: Store = {
  id: "store_test",
  slug: "test-market",
  name: "Test Market",
  nameAr: "",
  citySlug: "dakhla",
  category: "grocery",
  tagline: "",
  description: "",
  address: "Test",
  landmark: "Test",
  lat: 23.68,
  lng: -15.95,
  accent: "#0f6e6e",
  rating: 4.5,
  reviews: 10,
  prepTime: 20,
  minOrder: 40,
  deliveryFee: 8,
  isOpen: true,
  commissionRate: 10,
  phone: "+212600000000",
  ownerName: "Test",
};

const merchant: OrderActor = {
  role: "merchant",
  id: "user_merchant_sahara",
  name: "Sahara",
  storeId: "store_sahara_market",
};

describe("grocery availability", () => {
  it("does not promise delivery without drivers", () => {
    const store = { ...baseStore, grocery: { ...defaultGrocerySettings(baseStore), alwaysOpen: true, overnightStaffed: true } };
    const state = groceryAvailability(store, 0, new Date("2026-10-31T12:00:00Z"));
    expect(state.open).toBe(true);
    expect(state.delivery).toBe(false);
    expect(state.pickup).toBe(true);
    expect(state.reason).toContain("No drivers");
  });

  it("blocks overnight delivery when the store is not staffed", () => {
    const store = {
      ...baseStore,
      grocery: {
        ...defaultGrocerySettings(baseStore),
        alwaysOpen: true,
        overnightStaffed: false,
      },
    };
    // 02:00 Africa/Casablanca
    const state = groceryAvailability(store, 4, new Date("2026-10-31T01:00:00Z"));
    expect(state.night).toBe(true);
    expect(state.open).toBe(true);
    expect(state.delivery).toBe(false);
    expect(state.pickup).toBe(false);
  });

  it("adds night and express fees and respects zones", () => {
    const store = {
      ...baseStore,
      grocery: {
        ...defaultGrocerySettings(baseStore),
        expressEnabled: true,
        expressFee: 12,
        nightFee: 8,
        deliveryZones: [
          { id: "near", name: "Near", maxKm: 5, fee: 8, minOrder: 40 },
          { id: "far", name: "Far", maxKm: 15, fee: 14, minOrder: 60 },
        ],
      },
    };
    const fees = groceryFees({
      store,
      distanceKm: 3,
      express: true,
      now: new Date("2026-10-31T01:00:00Z"),
    });
    expect(fees?.deliveryFee).toBe(28); // 8 zone + 12 express + 8 night
    expect(fees?.minOrder).toBe(40);
    expect(groceryFees({ store, distanceKm: 40, express: false })).toBeNull();
  });

  it("resolves variant stock and badges", () => {
    const product = {
      id: "p",
      storeId: "s",
      category: "Fresh",
      name: "Milk",
      description: "",
      price: 9,
      emoji: "",
      available: true,
      stock: 2,
      variants: [
        { id: "big", label: "1 L", sku: "M-1", price: 12, stock: 5, unit: "1 L" },
      ],
    };
    expect(resolveProductStock(product, "big")).toMatchObject({ price: 12, stock: 5 });
    expect(resolveProductStock(product, "missing")).toBeNull();
    expect(stockBadge(2).tone).toBe("low");
    expect(stockBadge(0).tone).toBe("out");
    expect(stockBadge(undefined).tone).toBe("unlimited");
  });
});

describe("grocery order integrity", () => {
  it("reserves stock, requires the pickup code, commits stock and earns loyalty", async () => {
    const db = await import("@/lib/db");
    await db.resetDatabase();
    const store = await db.getStore("store_sahara_market");
    expect(store).toBeTruthy();
    const milkBefore = (await db.getProducts(store!.id)).find(
      (product) => product.name === "Whole Milk 1L",
    )!;
    const applesBefore = (await db.getProducts(store!.id)).find(
      (product) => product.name === "Apples 1kg",
    )!;
    expect(milkBefore.stock).toBe(4);

    const order = await db.createOrder(
      {
        citySlug: "dakhla",
        storeId: store!.id,
        customerName: "Mariam",
        customerPhone: "+212600000000",
        customerEmail: "customer@wassl.ma",
        address: "",
        landmark: "",
        lat: 0,
        lng: 0,
        fulfillment: "pickup",
        items: [
          { productId: milkBefore.id, qty: 1 },
          { productId: applesBefore.id, qty: 2 },
        ],
      },
      { role: "customer", id: "user_customer_mariam", name: "Mariam" },
    );

    expect(order.fulfillment).toBe("pickup");
    expect(order.pickupCode).toMatch(/^P\d{4}$/);
    const milkAfter = (await db.getProducts(store!.id)).find(
      (product) => product.id === milkBefore.id,
    )!;
    expect(milkAfter.stock).toBe(3);
    expect(
      (await db.getDb()).stockReservations?.every((reservation) => reservation.status === "reserved"),
    ).toBe(true);

    const accepted = await db.updateOrderStatus(order.id, "accepted", merchant);
    expect(accepted.status).toBe("accepted");
    await db.updateOrderStatus(order.id, "preparing", merchant);
    await db.updateOrderStatus(order.id, "ready", merchant);
    await expect(
      db.updateOrderStatus(order.id, "delivered", merchant),
    ).rejects.toThrow(/pickup code/i);
    const delivered = await db.updateOrderStatus(order.id, "delivered", merchant, {
      proofPin: order.pickupCode,
    });
    expect(delivered.status).toBe("delivered");
    expect(delivered.proofOfDelivery?.method).toBe("pin");
    expect(
      (await db.getDb()).stockReservations?.every((reservation) => reservation.status === "committed"),
    ).toBe(true);
  });

  it("restores stock exactly once when a grocery order is cancelled", async () => {
    const db = await import("@/lib/db");
    await db.resetDatabase();
    const store = await db.getStore("store_sahara_market");
    const milk = (await db.getProducts(store!.id)).find(
      (product) => product.name === "Whole Milk 1L",
    )!;
    expect(milk.stock).toBe(4);
    const order = await db.createOrder(
      {
        citySlug: "dakhla",
        storeId: store!.id,
        customerName: "Mariam",
        customerPhone: "+212600000000",
        address: "",
        landmark: "",
        lat: 0,
        lng: 0,
        fulfillment: "pickup",
        items: [
          { productId: milk.id, qty: 1 },
          { productId: (await db.getProducts(store!.id)).find((p) => p.name === "Apples 1kg")!.id, qty: 3 },
        ],
      },
      { role: "customer", id: "user_customer_mariam", name: "Mariam" },
    );
    expect(
      (await db.getProducts(store!.id)).find((p) => p.id === milk.id)!.stock,
    ).toBe(3);
    await db.updateOrderStatus(order.id, "cancelled", merchant, {
      note: "Store ran out of stock",
    });
    expect(
      (await db.getProducts(store!.id)).find((p) => p.id === milk.id)!.stock,
    ).toBe(4);
  });
});
