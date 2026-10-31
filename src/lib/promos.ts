export type PromoType = "percent" | "fixed" | "delivery";

export type PromoRule = {
  code: string;
  label: string;
  type: PromoType;
  /** Percent (0-100) or a fixed amount in MAD. Ignored for delivery promos. */
  value: number;
  minSubtotal?: number;
  maxDiscount?: number;
  /** City slugs where the code is accepted. Empty means every city. */
  cities?: string[];
};

/**
 * Local promo rules. This is intentionally small: a code is either a
 * percentage, a fixed amount, or a delivery waiver. Swap `PROMOS` for a remote
 * feed later without touching the checkout or the order writer.
 */
export const PROMOS: PromoRule[] = [
  {
    code: "WASSAL10",
    label: "10% off your order",
    type: "percent",
    value: 10,
    minSubtotal: 50,
    maxDiscount: 30,
  },
  {
    code: "DAKHLA15",
    label: "15 MAD off in Dakhla",
    type: "fixed",
    value: 15,
    minSubtotal: 80,
    cities: ["dakhla"],
  },
  {
    code: "FREEDELIVERY",
    label: "Free delivery",
    type: "delivery",
    value: 0,
    minSubtotal: 60,
  },
];

export type PromoQuote = {
  code: string;
  label: string;
  /** Amount taken off the subtotal, in MAD. */
  discount: number;
  freeDelivery: boolean;
};

export type PromoContext = {
  subtotal: number;
  deliveryFee: number;
  citySlug: string;
};

export type PromoResult =
  | { ok: true; quote: PromoQuote }
  | { ok: false; error: string };

export function quotePromo(code: string, context: PromoContext): PromoResult {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { ok: false, error: "Enter a promo code" };

  const rule = PROMOS.find((promo) => promo.code === normalized);
  if (!rule) return { ok: false, error: "That promo code is not valid" };

  const minimum = rule.minSubtotal ?? 0;
  if (context.subtotal < minimum) {
    return {
      ok: false,
      error: `Spend at least ${minimum} MAD to use ${rule.code}`,
    };
  }
  if (rule.cities?.length && !rule.cities.includes(context.citySlug)) {
    return {
      ok: false,
      error: `${rule.code} is not available in this city`,
    };
  }

  let discount = 0;
  let freeDelivery = false;
  if (rule.type === "percent") {
    const raw = (context.subtotal * rule.value) / 100;
    discount = Math.round(Math.min(raw, rule.maxDiscount ?? raw));
  } else if (rule.type === "fixed") {
    discount = Math.min(rule.value, context.subtotal);
  } else {
    freeDelivery = context.deliveryFee > 0;
  }

  return {
    ok: true,
    quote: { code: rule.code, label: rule.label, discount, freeDelivery },
  };
}
