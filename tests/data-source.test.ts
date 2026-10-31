import { describe, expect, it } from "vitest";
import { getDataSourceStatus, verifySnapshotIntegrity } from "@/lib/data-source";
import { buildImportedRestaurants } from "@/lib/restaurant-catalog";
import { getOpenState } from "@/lib/hours";

describe("locked restaurant snapshot", () => {
  it("verifies its checksum", () => {
    const integrity = verifySnapshotIntegrity();
    expect(integrity.ok).toBe(true);
    expect(integrity.actual).toMatch(/^[a-f0-9]{64}$/);
  });

  it("reports a locked provider with real coverage", () => {
    const status = getDataSourceStatus();
    expect(status.locked).toBe(true);
    expect(status.activeProvider).toBe("locked-snapshot");
    expect(status.restaurantCount).toBeGreaterThan(20);
    expect(status.menuItemCount).toBeGreaterThan(status.restaurantCount * 10);
    expect(status.cityCounts.dakhla).toBeGreaterThan(10);
    expect(status.sources.map((source) => source.id)).toEqual(["marocapis", "serpapi"]);
  });

  it("expands every restaurant into a locked menu with prices", () => {
    const { stores, products } = buildImportedRestaurants();
    expect(stores.length).toBeGreaterThan(20);
    expect(products.some((product) => product.modifiers?.length)).toBe(true);
    expect(products.every((product) => product.locked)).toBe(true);
    expect(products.every((product) => product.price > 0)).toBe(true);
    expect(stores.every((store) => store.locked && store.dataOrigin === "marocapis")).toBe(true);
  });
});

describe("opening hours", () => {
  const store = {
    isOpen: true,
    prepTime: 25,
    openingHours: [{ days: "Mon–Sun", open: "08:00", close: "00:00" }],
  };

  it("is open during Casablanca service hours", () => {
    // 10:00 UTC = 11:00 in Casablanca (UTC+1)
    const state = getOpenState(store, new Date("2026-10-26T10:00:00Z"));
    expect(state.open).toBe(true);
  });

  it("reports the next opening when closed overnight", () => {
    // 02:00 UTC = 03:00 in Casablanca
    const state = getOpenState(store, new Date("2026-10-26T02:00:00Z"));
    expect(state.open).toBe(false);
    expect(state.detail).toBe("Opens 08:00");
  });

  it("keeps stores without published hours open", () => {
    expect(
      getOpenState({ isOpen: true, prepTime: 20, openingHours: [] }).open,
    ).toBe(true);
  });

  it("respects the merchant kill switch", () => {
    expect(
      getOpenState({ ...store, isOpen: false }, new Date("2026-10-26T10:00:00Z")).open,
    ).toBe(false);
  });
});
