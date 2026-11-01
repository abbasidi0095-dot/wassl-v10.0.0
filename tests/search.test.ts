import { describe, expect, it } from "vitest";
import { createSeedDatabase } from "@/lib/seed";
import {
  matchScore,
  normalizeSearchText,
  searchPlatform,
} from "@/lib/search";

describe("unified search", () => {
  const db = createSeedDatabase();

  it("normalizes Arabic diacritics and letter variants", () => {
    expect(normalizeSearchText("مَطَاعِم")).toBe("مطاعم");
    expect(normalizeSearchText("Dakhla  Grill")).toBe("dakhla grill");
  });

  it("tolerates a one-character typo", () => {
    expect(matchScore("dakhla gril", ["Dakhla Grill"])).toBeGreaterThan(0);
    expect(matchScore("sahara markt", ["Sahara Market"])).toBeGreaterThan(0);
  });

  it("finds stores, products and categories from real seed data", () => {
    const result = searchPlatform(db, { query: "water", citySlug: "dakhla" });
    const products = result.groups.find((group) => group.kind === "product");
    expect(products?.hits.some((hit) => /water/i.test(hit.title))).toBe(true);
    expect(result.groups.some((group) => group.kind === "store")).toBe(true);
  });

  it("returns a store for a typo and links to its storefront", () => {
    const result = searchPlatform(db, {
      query: "dakhla gril",
      citySlug: "dakhla",
    });
    const stores = result.groups.find((group) => group.kind === "store");
    expect(stores?.hits[0]?.title).toBe("Dakhla Grill");
    expect(stores?.hits[0]?.href).toBe("/store/dakhla-grill");
  });

  it("returns real services and delivery choices for an empty query", () => {
    const result = searchPlatform(db, { query: "", citySlug: "dakhla" });
    expect(result.groups.some((group) => group.kind === "service")).toBe(true);
    expect(result.groups.some((group) => group.kind === "delivery")).toBe(true);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });
});
