import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@/lib/types";

let dataDir: string;

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "wassl-chat-"));
  process.env.WASSL_DATA_DIR = dataDir;
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

async function sessions() {
  const db = await import("@/lib/db");
  const user = await db.getUserByEmail("customer@wassl.ma");
  const driver = (await db.getDrivers()).find((entry) => entry.active)!;
  const store = (await db.getStores()).find((entry) => entry.category === "grocery")!;
  const customer: Session = {
    userId: user!.id,
    role: "customer",
    name: user!.name,
    email: user!.email,
    status: "active",
  };
  const admin: Session = {
    userId: "user_admin",
    role: "admin",
    name: "Operations",
    status: "active",
  };
  const driverSession: Session = {
    userId: "user_driver",
    role: "driver",
    name: driver.name,
    driverId: driver.id,
    status: "active",
  };
  const merchant: Session = {
    userId: "user_merchant",
    role: "merchant",
    name: "Merchant",
    storeId: store.id,
    status: "active",
  };
  return { db, customer, admin, driverSession, merchant, user: user! };
}

describe("Wassl conversations", () => {
  it("creates a support thread and enforces participant access", async () => {
    const { db, customer, admin, driverSession } = await sessions();
    await db.resetDatabase();
    const thread = await db.createChatThread(
      {
        topic: "support",
        subject: "Late grocery order",
        initialMessage: "My order is late.",
      },
      customer,
    );
    expect(thread.customerId).toBe(customer.userId);
    expect(thread.aiEnabled).toBe(true);

    const duplicate = await db.createChatThread(
      { topic: "support", subject: "Late grocery order" },
      customer,
    );
    expect(duplicate.id).toBe(thread.id);

    const messages = await db.getChatMessages(thread.id, customer);
    expect(messages).toHaveLength(1);
    expect(await db.getChatMessages(thread.id, admin)).toHaveLength(1);
    expect(await db.getChatMessages(thread.id, driverSession)).toHaveLength(0);
  });

  it("lets a human agent take over and closes the thread", async () => {
    const { db, customer, admin } = await sessions();
    await db.resetDatabase();
    const thread = await db.createChatThread(
      { topic: "support", subject: "Refund question", initialMessage: "I need help" },
      customer,
    );
    const reply = await db.addChatMessage(thread.id, admin, "A human agent is here.");
    expect(reply.senderRole).toBe("admin");

    const updated = await db.getChatThread(thread.id, customer);
    expect(updated?.aiEnabled).toBe(false);

    await db.setChatThreadStatus(thread.id, "closed", customer);
    await expect(
      db.addChatMessage(thread.id, customer, "One more thing"),
    ).rejects.toThrow(/closed/i);
  });

  it("keeps store and driver conversations scoped to the participant", async () => {
    const { db, customer, merchant, driverSession } = await sessions();
    await db.resetDatabase();
    const storeThread = await db.createChatThread(
      { topic: "grocery", subject: "Missing item", storeId: merchant.storeId },
      customer,
    );
    expect(storeThread.storeId).toBe(merchant.storeId);
    expect((await db.getChatThreads(merchant)).some((entry) => entry.id === storeThread.id)).toBe(true);
    expect((await db.getChatThreads(driverSession)).some((entry) => entry.id === storeThread.id)).toBe(false);
  });
});

describe("order ratings", () => {
  it("accepts one rating after delivery and updates the store average", async () => {
    const { db, customer, admin } = await sessions();
    await db.resetDatabase();
    const before = await db.getStore("store_dakhla_grill");
    const product = (await db.getProducts("store_dakhla_grill")).find(
      (entry) => entry.id === "product_001",
    )!;
    const order = await db.createOrder(
      {
        citySlug: "dakhla",
        storeId: "store_dakhla_grill",
        customerName: "Mariam",
        customerPhone: "+212600000000",
        customerEmail: customer.email,
        address: "12 Rue de la Plage",
        landmark: "Lighthouse",
        lat: 23.69,
        lng: -15.94,
        items: [{ productId: product.id, qty: 2 }],
      },
      { role: "customer", id: customer.userId, name: "Mariam" },
    );
    const driver = (await db.getDrivers("dakhla")).find((entry) => entry.active)!;
    await db.updateOrderStatus(order.id, "accepted", admin);
    await db.updateOrderStatus(order.id, "preparing", admin);
    await db.updateOrderStatus(order.id, "ready", admin);
    await db.assignDriver(order.id, driver.id, admin);
    await db.updateOrderStatus(order.id, "picked_up", admin);
    await db.updateOrderStatus(order.id, "en_route", admin);
    await db.updateOrderStatus(order.id, "delivered", admin);

    const rated = await db.rateOrder(order.id, customer, 5, "Excellent");
    expect(rated.rating?.stars).toBe(5);
    await expect(db.rateOrder(order.id, customer, 4)).rejects.toThrow(/already/i);

    const after = await db.getStore("store_dakhla_grill");
    expect(after!.reviews).toBe(before!.reviews + 1);
  });
});
