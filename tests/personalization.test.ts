import { describe, expect, it } from "vitest";
import { createSeedDatabase } from "@/lib/seed";
import { buildHomeFeed } from "@/lib/personalization";
import type { Order } from "@/lib/types";

describe("deterministic home personalization", () => {
  const db = createSeedDatabase();

  it("puts a recent basket item first for a signed-in customer", () => {
    const base = db.orders[0];
    const order: Order = {
      ...base,
      id: "order_history_1",
      customerEmail: "customer@wassl.ma",
      storeId: "store_dakhla_grill",
      items: [
        {
          productId: "product_001",
          name: "Dakhla Smash",
          emoji: "",
          price: 58,
          qty: 1,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const feed = buildHomeFeed({
      citySlug: "dakhla",
      stores: db.stores,
      orders: [order],
      popularProducts: [],
      now: new Date("2026-11-01T19:30:00Z"),
    });

    expect(feed.personalized).toBe(true);
    expect(feed.slot).toBe("dinner");
    expect(feed.items[0]?.reason).toBe("reorder");
    expect(feed.items[0]?.title).toBe("Dakhla Smash");
    expect(feed.items[0]?.href).toContain("/store/dakhla-grill?product=product_001");
  });

  it("falls back to real popular and nearby stores without history", () => {
    const feed = buildHomeFeed({
      citySlug: "dakhla",
      stores: db.stores,
      popularProducts: [],
      orders: [],
      now: new Date("2026-11-01T12:00:00Z"),
    });

    expect(feed.personalized).toBe(false);
    expect(feed.slot).toBe("popular");
    expect(feed.items.length).toBeGreaterThan(0);
    expect(feed.items.every((item) => item.kind === "store")).toBe(true);
  });

  it("includes only promotions valid in the selected city", () => {
    const feed = buildHomeFeed({
      citySlug: "dakhla",
      stores: db.stores,
      orders: [],
      now: new Date("2026-11-01T12:00:00Z"),
    });
    expect(feed.promos.some((promo) => promo.code === "DAKHLA15")).toBe(true);
    expect(feed.promos.some((promo) => promo.code === "WASSAL10")).toBe(true);
  });
});
