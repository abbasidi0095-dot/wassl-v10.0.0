import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let dataDir: string;

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "wassl-events-"));
  process.env.WASSL_DATA_DIR = dataDir;
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe("event batching", () => {
  it("never emits events for a mutation that rolls back", async () => {
    const db = await import("@/lib/db");
    const { publish, subscribe } = await import("@/lib/events");
    await db.resetDatabase();

    const seen: string[] = [];
    const unsubscribe = subscribe((event) => seen.push(event.type));
    try {
      await expect(
        db.mutate(() => {
          publish({ type: "settings" });
          throw new Error("rollback");
        }),
      ).rejects.toThrow("rollback");
      expect(seen).toEqual([]);
    } finally {
      unsubscribe();
    }
  });

  it("flushes one event per committed order under concurrency", async () => {
    const db = await import("@/lib/db");
    const { subscribe } = await import("@/lib/events");
    await db.resetDatabase();

    const store = (await db.getStore("dakhla-grill"))!;
    const product = (await db.getProducts(store.id))[0];
    const base = {
      citySlug: "dakhla",
      storeId: store.id,
      customerName: "Event Test",
      customerPhone: "+212 600 222 333",
      address: "Address",
      landmark: "Landmark",
      lat: 23.69,
      lng: -15.94,
      items: [{ productId: product.id, qty: 1 }],
    };

    const orderEvents: string[] = [];
    const unsubscribe = subscribe((event) => {
      if (event.type === "order") orderEvents.push(event.orderId ?? "");
    });
    try {
      const created = await Promise.all([
        db.createOrder(base),
        db.createOrder(base),
      ]);
      expect(orderEvents.sort()).toEqual(created.map((order) => order.id).sort());
    } finally {
      unsubscribe();
    }
  });

  it("replays only events that match the long-poll filter", async () => {
    const { getEventCursor, publish, readEvents } = await import("@/lib/events");
    const start = getEventCursor();
    publish({
      type: "order",
      orderId: "order_filter_a",
      storeId: "store_a",
      citySlug: "dakhla",
    });
    publish({
      type: "driver",
      driverId: "driver_b",
      citySlug: "laayoune",
    });

    expect(readEvents(start, { storeId: "store_a" }).events).toHaveLength(1);
    expect(readEvents(start, { citySlug: "laayoune" }).events).toHaveLength(1);
    expect(
      readEvents(start, { type: "order", orderId: "order_filter_a" }).events[0]
        ?.status,
    ).toBeUndefined();
  });

  it("wakes a pending long poll as soon as a matching event is committed", async () => {
    const { getEventCursor, publish, waitForEvents } = await import(
      "@/lib/events"
    );
    const start = getEventCursor();
    const pending = waitForEvents(
      start,
      { type: "order", storeId: "store_live" },
      1500,
    );
    setTimeout(() => {
      publish({
        type: "order",
        orderId: "order_live",
        storeId: "store_live",
        citySlug: "dakhla",
        status: "ready",
      });
    }, 25);

    const result = await pending;
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      type: "order",
      orderId: "order_live",
      status: "ready",
    });
    expect(result.cursor).toBeGreaterThan(start);
  });

  it("returns an empty batch after the timeout", async () => {
    const { getEventCursor, waitForEvents } = await import("@/lib/events");
    const started = Date.now();
    const result = await waitForEvents(
      getEventCursor(),
      { type: "settings", storeId: "never-matches" },
      1000,
    );
    expect(result.events).toEqual([]);
    expect(Date.now() - started).toBeGreaterThanOrEqual(900);
  });
});
