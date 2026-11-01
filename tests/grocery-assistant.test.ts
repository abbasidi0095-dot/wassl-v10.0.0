import { describe, expect, it } from "vitest";
import { createSeedDatabase } from "@/lib/seed";
import { buildAssistantPlan } from "@/lib/grocery-assistant";
import type { Order } from "@/lib/types";

const db = createSeedDatabase();

function plan(query: string, orders: Order[] = []) {
  return buildAssistantPlan({
    query,
    citySlug: "dakhla",
    stores: db.stores,
    products: db.products,
    orders,
    now: new Date("2026-11-01T12:00:00Z"),
  });
}

describe("grocery shopping assistant", () => {
  it("turns couscous into an editable ingredient list", () => {
    const result = plan("Prepare ingredients for couscous");
    expect(result.intent).toBe("couscous");
    expect(result.items.length).toBeGreaterThan(2);
    expect(result.estimatedTotal).toBeGreaterThan(0);
    expect(result.items.every((item) => item.store.category === "grocery")).toBe(true);
  });

  it("picks the cheapest water when asked", () => {
    const result = plan("Find the cheapest bottled water");
    expect(result.intent).toBe("cheapest");
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].reason).toBe("cheapest");
    const groceryIds = new Set(
      db.stores.filter((store) => store.category === "grocery").map((store) => store.id),
    );
    const waterPrices = db.products
      .filter((product) => groceryIds.has(product.storeId) && /water/i.test(product.name))
      .map((product) => product.price);
    expect(result.items[0].product.price).toBe(Math.min(...waterPrices));
  });

  it("understands cleaning and baby intents", () => {
    expect(plan("Build a household cleaning basket").intent).toBe("cleaning");
    expect(plan("Find baby essentials").intent).toBe("baby");
  });

  it("uses the customer's previous products for a usual weekly shop", () => {
    const base = db.orders[0];
    const order: Order = {
      ...base,
      id: "order_assistant",
      customerEmail: "customer@wassl.ma",
      storeId: "store_sahara_market",
      items: [
        {
          productId: "product_017",
          name: "Water 6 x 1.5L",
          emoji: "",
          price: 24,
          qty: 2,
        },
      ],
    };
    const result = plan("Find my usual weekly groceries", [order]);
    expect(result.intent).toBe("weekly");
    expect(result.items[0].reason).toBe("usual");
    expect(result.items[0].product.id).toBe("product_017");
  });

  it("never invents a product when nothing matches", () => {
    const result = plan("zzzz-not-a-product");
    expect(result.items).toHaveLength(0);
    expect(result.missing.length).toBeGreaterThan(0);
  });
});
