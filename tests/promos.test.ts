import { describe, expect, it } from "vitest";
import { quotePromo } from "@/lib/promos";

const dakhla = { subtotal: 100, deliveryFee: 7, citySlug: "dakhla" };

describe("promo codes", () => {
  it("applies a percentage with a cap", () => {
    const result = quotePromo("wassal10", dakhla);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.quote.code).toBe("WASSAL10");
      expect(result.quote.discount).toBe(10);
    }

    const capped = quotePromo("WASSAL10", { ...dakhla, subtotal: 900 });
    expect(capped.ok).toBe(true);
    if (capped.ok) expect(capped.quote.discount).toBe(30);
  });

  it("enforces the minimum subtotal", () => {
    const result = quotePromo("WASSAL10", { ...dakhla, subtotal: 40 });
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error).toMatch(/at least 50/i);
  });

  it("applies a fixed city promo only in that city", () => {
    const local = quotePromo("DAKHLA15", dakhla);
    expect(local.ok).toBe(true);
    if (local.ok) expect(local.quote.discount).toBe(15);

    const elsewhere = quotePromo("DAKHLA15", { ...dakhla, citySlug: "laayoune" });
    expect(elsewhere).toMatchObject({ ok: false });
  });

  it("waives the delivery fee", () => {
    const result = quotePromo("FREEDELIVERY", dakhla);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.quote.freeDelivery).toBe(true);
      expect(result.quote.discount).toBe(0);
    }
  });

  it("rejects unknown and empty codes", () => {
    expect(quotePromo("NOPE", dakhla)).toMatchObject({ ok: false });
    expect(quotePromo("   ", dakhla)).toMatchObject({ ok: false });
  });
});
