import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OrderActor } from "@/lib/order-machine";
import {
  LOYALTY_PLUS_THRESHOLD,
  LOYALTY_PREMIUM_THRESHOLD,
  pointsForOrder,
  tierForLifetime,
  tierProgress,
} from "@/lib/loyalty";

let dataDir: string;

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "wassl-loyalty-"));
  process.env.WASSL_DATA_DIR = dataDir;
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

const admin: OrderActor = { role: "admin", id: "user_admin", name: "Ops" };

describe("Wassl Club", () => {
  it("maps lifetime points to tiers", () => {
    expect(tierForLifetime(0)).toBe("basic");
    expect(tierForLifetime(LOYALTY_PLUS_THRESHOLD)).toBe("plus");
    expect(tierForLifetime(LOYALTY_PREMIUM_THRESHOLD)).toBe("premium");
    const progress = tierProgress(750);
    expect(progress.tier).toBe("plus");
    expect(progress.next?.id).toBe("premium");
    expect(progress.percent).toBeGreaterThan(0);
  });

  it("uses grocery and food earning rules", () => {
    const order = {
      id: "order_test",
      subtotal: 90,
      status: "delivered",
    } as Parameters<typeof pointsForOrder>[0];
    const grocery = {
      category: "grocery",
      grocery: { loyaltyPointsPer10Mad: 2 },
    } as Parameters<typeof pointsForOrder>[1];
    const restaurant = { category: "restaurant" } as Parameters<typeof pointsForOrder>[1];
    expect(pointsForOrder(order, grocery)).toBe(18);
    expect(pointsForOrder(order, restaurant)).toBe(4);
  });

  it("creates a ledger account and records an audited admin adjustment", async () => {
    const db = await import("@/lib/db");
    const user = await db.getUserByEmail("customer@wassl.ma");
    expect(user).toBeTruthy();
    const before = await db.getLoyaltyOverview(user!.id);
    expect(before.account.userId).toBe(user!.id);

    const startingPoints = before.account.points;
    const adjusted = await db.adjustLoyaltyPoints(user!.id, 120, "Goodwill", admin);
    expect(adjusted.points).toBe(startingPoints + 120);

    const after = await db.getLoyaltyOverview(user!.id);
    expect(after.transactions[0].type).toBe("adjust");
    expect(after.transactions[0].points).toBe(120);
    expect(after.transactions[0].actorName).toBe("Ops");
  });
});

describe("Wassl Club ledger flow", () => {
  it("redeems points on an order and earns again on delivery", async () => {
    const db = await import("@/lib/db");
    await db.resetDatabase();
    const user = await db.getUserByEmail("customer@wassl.ma");
    expect(user).toBeTruthy();
    await db.adjustLoyaltyPoints(user!.id, 100, "Test credit", admin);

    const store = await db.getStore("store_sahara_market");
    expect(store).toBeTruthy();
    const products = await db.getProducts(store!.id);
    const milk = products.find((product) => product.name === "Whole Milk 1L")!;
    const apples = products.find((product) => product.name === "Apples 1kg")!;

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
        loyaltyPoints: 100,
        items: [
          { productId: milk.id, qty: 1 },
          { productId: apples.id, qty: 2 },
        ],
      },
      { role: "customer", id: user!.id, name: "Mariam" },
    );
    expect(order.loyaltyPointsUsed).toBe(100);
    expect(order.loyaltyDiscount).toBe(10);

    const afterRedeem = await db.getLoyaltyOverview(user!.id);
    expect(afterRedeem.account.points).toBe(0);
    expect(afterRedeem.transactions[0].type).toBe("redeem");
    expect(afterRedeem.transactions[0].points).toBe(-100);

    const merchant = {
      role: "merchant" as const,
      id: "user_merchant_dakhla",
      name: "Merchant",
      storeId: store!.id,
    };
    await db.updateOrderStatus(order.id, "accepted", merchant);
    await db.updateOrderStatus(order.id, "preparing", merchant);
    await db.updateOrderStatus(order.id, "ready", merchant);
    await db.updateOrderStatus(order.id, "delivered", merchant, {
      proofPin: order.pickupCode,
    });

    const afterDelivery = await db.getLoyaltyOverview(user!.id);
    expect(afterDelivery.account.points).toBeGreaterThan(0);
    expect(
      afterDelivery.transactions.some((entry) => entry.type === "earn"),
    ).toBe(true);
  });
});
