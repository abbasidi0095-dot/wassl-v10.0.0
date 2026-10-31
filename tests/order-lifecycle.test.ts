import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OrderActor } from "@/lib/order-machine";
import type { Product, Store } from "@/lib/types";

let dataDir: string;

const merchant: OrderActor = {
  role: "merchant",
  id: "user_merchant_dakhla",
  name: "Merchant",
  storeId: "store_dakhla_grill",
};
const admin: OrderActor = { role: "admin", id: "user_admin", name: "Ops" };
const driver: OrderActor = {
  role: "driver",
  id: "user_driver_youssef",
  name: "Youssef",
  driverId: "driver_youssef",
};

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "wassl-db-"));
  process.env.WASSL_DATA_DIR = dataDir;
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

async function freshDb() {
  return import("@/lib/db");
}

async function findStoreWithProduct(
  db: Awaited<ReturnType<typeof freshDb>>,
  predicate: (product: Product) => boolean,
): Promise<{ store: Store; product: Product }> {
  const stores = await db.getStores("dakhla");
  for (const store of stores) {
    if (store.dataOrigin !== "marocapis") continue;
    const products = await db.getProducts(store.id);
    const product = products.find(predicate);
    if (product) return { store, product };
  }
  throw new Error("No matching store and product found");
}

describe("order lifecycle", () => {
  it("prices modifiers on the server and walks the full happy path", async () => {
    const db = await freshDb();
    await db.resetDatabase();

    const { store, product } = await findStoreWithProduct(db, (entry) =>
      Boolean(entry.modifiers?.some((group) => group.id === "patty")),
    );

    const double = product.modifiers!
      .find((group) => group.id === "patty")!
      .options.find((option) => option.id === "double")!;

    const order = await db.createOrder({
      citySlug: "dakhla",
      storeId: store.id,
      customerName: "Test Customer",
      customerPhone: "+212 600 000 000",
      address: "Test address",
      landmark: "Test landmark",
      lat: 23.69,
      lng: -15.94,
      items: [{ productId: product.id, qty: 1, optionIds: [double.id] }],
    });

    const storeMerchant: OrderActor = { ...merchant, storeId: store.id };

    expect(order.items[0].price).toBe(product.price + double.priceDelta);
    expect(order.total).toBe(order.subtotal + store.deliveryFee);
    expect(order.status).toBe("placed");

    await db.updateOrderStatus(order.id, "accepted", storeMerchant);
    await db.updateOrderStatus(order.id, "preparing", storeMerchant);
    await db.updateOrderStatus(order.id, "ready", storeMerchant);
    await db.assignDriver(order.id, "driver_youssef", admin);
    await db.updateOrderStatus(order.id, "picked_up", driver);
    await db.updateOrderStatus(order.id, "en_route", driver);
    const delivered = await db.updateOrderStatus(order.id, "delivered", driver);

    expect(delivered.status).toBe("delivered");
    expect(delivered.cashCollected).toBe(true);
    expect(delivered.deliveredAt).toBeTruthy();

    const courier = (await db.getDriver("driver_youssef"))!;
    expect(courier.status).toBe("available");
    expect(courier.cashOnHand).toBeGreaterThan(128);

    const logs = await db.getAuditLogs({ entity: "order", entityId: order.id });
    expect(logs.length).toBeGreaterThanOrEqual(7);
    expect(logs.some((entry) => entry.action === "order.assign_driver")).toBe(true);
    expect(
      logs.every(
        (entry) => entry.actorRole !== "admin" || entry.actorId === "user_admin",
      ),
    ).toBe(true);
  });

  it("rejects an illegal admin jump and keeps the order unchanged", async () => {
    const db = await freshDb();
    const { OrderRuleError } = await import("@/lib/order-machine");
    await db.resetDatabase();
    const store = (await db.getStore("dakhla-grill"))!;
    const product = (await db.getProducts(store.id))[0];

    const order = await db.createOrder({
      citySlug: "dakhla",
      storeId: store.id,
      customerName: "Test",
      customerPhone: "+212 600 000 001",
      address: "Address",
      landmark: "Landmark",
      lat: 23.69,
      lng: -15.94,
      items: [{ productId: product.id, qty: 1 }],
    });

    await expect(
      db.updateOrderStatus(order.id, "delivered", admin),
    ).rejects.toThrow(OrderRuleError);
    expect((await db.getOrder(order.id))!.status).toBe("placed");
  });

  it("requires a cancellation reason and stores it", async () => {
    const db = await freshDb();
    await db.resetDatabase();
    const store = (await db.getStore("dakhla-grill"))!;
    const product = (await db.getProducts(store.id))[0];
    const order = await db.createOrder({
      citySlug: "dakhla",
      storeId: store.id,
      customerName: "Test",
      customerPhone: "+212 600 000 002",
      address: "Address",
      landmark: "Landmark",
      lat: 23.69,
      lng: -15.94,
      items: [{ productId: product.id, qty: 1 }],
    });

    await expect(
      db.updateOrderStatus(order.id, "cancelled", merchant),
    ).rejects.toThrow(/reason/i);

    const cancelled = await db.updateOrderStatus(
      order.id,
      "cancelled",
      merchant,
      { note: "Kitchen closed early" },
    );
    expect(cancelled.cancellationReason).toBe("Kitchen closed early");
    expect(cancelled.cancelledAt).toBeTruthy();
  });

  it("refuses to assign a busy or offline driver", async () => {
    const db = await freshDb();
    await db.resetDatabase();
    const store = (await db.getStore("dakhla-grill"))!;
    const product = (await db.getProducts(store.id))[0];
    const order = await db.createOrder({
      citySlug: "dakhla",
      storeId: store.id,
      customerName: "Test",
      customerPhone: "+212 600 000 003",
      address: "Address",
      landmark: "Landmark",
      lat: 23.69,
      lng: -15.94,
      items: [{ productId: product.id, qty: 1 }],
    });
    await db.updateOrderStatus(order.id, "accepted", merchant);
    await db.updateOrderStatus(order.id, "preparing", merchant);
    await db.updateOrderStatus(order.id, "ready", merchant);

    await expect(
      db.assignDriver(order.id, "driver_amina", admin),
    ).rejects.toThrow(/offline/i);

    await db.assignDriver(order.id, "driver_youssef", admin);
    await expect(
      db.assignDriver(order.id, "driver_youssef", admin),
    ).rejects.toThrow(/unassign/i);
  });

  it("lets a driver claim a ready order and exposes the live city queue", async () => {
    const db = await freshDb();
    await db.resetDatabase();
    const store = (await db.getStore("dakhla-grill"))!;
    const product = (await db.getProducts(store.id))[0];
    const order = await db.createOrder({
      citySlug: "dakhla",
      storeId: store.id,
      customerName: "Claim Customer",
      customerPhone: "+212 600 000 006",
      address: "Customer address",
      landmark: "Landmark",
      lat: 23.69,
      lng: -15.94,
      items: [{ productId: product.id, qty: 1 }],
    });

    await db.updateOrderStatus(order.id, "accepted", merchant);
    await db.updateOrderStatus(order.id, "preparing", merchant);
    await db.updateOrderStatus(order.id, "ready", merchant);

    const before = await db.getDriverBoard("driver_youssef");
    expect(before?.cityOrders.map((entry) => entry.id)).toContain(order.id);
    const queued = before?.cityOrders.find((entry) => entry.id === order.id);
    expect(queued?.customerPhone).toBe("");
    expect(queued?.notes).toBeUndefined();

    await expect(
      db.assignDriver(order.id, "driver_amina", driver),
    ).rejects.toThrow(/themselves/i);

    const claimed = await db.assignDriver(
      order.id,
      "driver_youssef",
      driver,
    );
    expect(claimed.driverId).toBe("driver_youssef");
    expect(claimed.status).toBe("assigned");

    const after = await db.getDriverBoard("driver_youssef");
    expect(after?.orders.map((entry) => entry.id)).toContain(order.id);
    expect(after?.cityOrders.map((entry) => entry.id)).not.toContain(order.id);
    expect(after?.driver.status).toBe("busy");
  });

  it("applies a promo on the server and rejects an invalid code", async () => {
    const db = await freshDb();
    await db.resetDatabase();
    const store = (await db.getStore("dakhla-grill"))!;
    const product = (await db.getProducts(store.id))[0];
    const base = {
      citySlug: "dakhla",
      storeId: store.id,
      customerName: "Test",
      customerPhone: "+212 600 000 005",
      address: "Address",
      landmark: "Landmark",
      lat: 23.69,
      lng: -15.94,
      items: [{ productId: product.id, qty: 2 }],
    };

    await expect(
      db.createOrder({ ...base, promoCode: "NOPE" }),
    ).rejects.toThrow(/not valid/i);

    const order = await db.createOrder({ ...base, promoCode: "wassal10" });
    expect(order.promoCode).toBe("WASSAL10");
    expect(order.discount).toBeGreaterThan(0);
    expect(order.total).toBe(
      order.subtotal + order.deliveryFee - (order.discount ?? 0),
    );
  });

  it("rejects unknown menu options instead of trusting the client price", async () => {
    const db = await freshDb();
    await db.resetDatabase();
    const { store, product } = await findStoreWithProduct(db, (entry) =>
      Boolean(entry.modifiers?.length),
    );

    await expect(
      db.createOrder({
        citySlug: "dakhla",
        storeId: store.id,
        customerName: "Test",
        customerPhone: "+212 600 000 004",
        address: "Address",
        landmark: "Landmark",
        lat: 23.69,
        lng: -15.94,
        items: [
          { productId: product.id, qty: 1, optionIds: ["not-a-real-option"] },
        ],
      }),
    ).rejects.toThrow();
  });
});

describe("customer email", () => {
  it("keeps the address on the order but hides it from the driver queue", async () => {
    const db = await freshDb();
    await db.resetDatabase();
    const store = (await db.getStore("dakhla-grill"))!;
    const product = (await db.getProducts(store.id))[0];

    const order = await db.createOrder({
      citySlug: "dakhla",
      storeId: store.id,
      customerName: "Test Customer",
      customerPhone: "+212 600 000 002",
      customerEmail: "customer@example.com",
      address: "Address",
      landmark: "Landmark",
      lat: 23.69,
      lng: -15.94,
      items: [{ productId: product.id, qty: 1 }],
    });

    expect(order.customerEmail).toBe("customer@example.com");

    const board = await db.getDriverBoard("driver_youssef");
    const queued = board!.cityOrders.find((item) => item.id === order.id)!;
    expect(queued.customerEmail).toBeUndefined();
    expect(queued.customerPhone).toBe("");
  });
});
