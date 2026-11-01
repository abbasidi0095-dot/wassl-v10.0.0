import type {
  ServiceCommission,
  ServiceCommissionId,
  ServiceCommissions,
} from "./types";

export const SERVICE_COMMISSION_DEFINITIONS: {
  id: ServiceCommissionId;
  label: string;
  basis: string;
  description: string;
  exampleBase: number;
}[] = [
  {
    id: "food",
    label: "Food to go",
    basis: "Order subtotal",
    description:
      "Restaurants, cafés and other store orders. The fixed fee is skipped for pickup orders.",
    exampleBase: 100,
  },
  {
    id: "grocery",
    label: "Grocery",
    basis: "Grocery goods",
    description:
      "Supermarket baskets, delivery or pickup. The percentage applies to goods, not the delivery fee.",
    exampleBase: 100,
  },
  {
    id: "pharmacy",
    label: "Pharmacy",
    basis: "Pharmacy goods",
    description:
      "Over-the-counter health and care products. The percentage applies to goods, not delivery.",
    exampleBase: 100,
  },
  {
    id: "taxi",
    label: "Taxi",
    basis: "Ride fare",
    description:
      "Completed cash rides. Fixed fee and percentage both apply to the fare.",
    exampleBase: 50,
  },
];

export const DEFAULT_SERVICE_COMMISSIONS: ServiceCommissions = {
  food: { fixedFee: 5, rate: 0 },
  grocery: { fixedFee: 5, rate: 5 },
  pharmacy: { fixedFee: 5, rate: 5 },
  taxi: { fixedFee: 2, rate: 0 },
};

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

/** Merge stored or partial values over the shipped defaults and clamp them. */
export function normalizeServiceCommissions(
  input?: Partial<Record<ServiceCommissionId, Partial<ServiceCommission>>>,
): ServiceCommissions {
  return {
    food: {
      fixedFee: clamp(input?.food?.fixedFee, 0, 100, DEFAULT_SERVICE_COMMISSIONS.food.fixedFee),
      rate: clamp(input?.food?.rate, 0, 40, DEFAULT_SERVICE_COMMISSIONS.food.rate),
    },
    grocery: {
      fixedFee: clamp(
        input?.grocery?.fixedFee,
        0,
        100,
        DEFAULT_SERVICE_COMMISSIONS.grocery.fixedFee,
      ),
      rate: clamp(input?.grocery?.rate, 0, 40, DEFAULT_SERVICE_COMMISSIONS.grocery.rate),
    },
    pharmacy: {
      fixedFee: clamp(
        input?.pharmacy?.fixedFee,
        0,
        100,
        DEFAULT_SERVICE_COMMISSIONS.pharmacy.fixedFee,
      ),
      rate: clamp(input?.pharmacy?.rate, 0, 40, DEFAULT_SERVICE_COMMISSIONS.pharmacy.rate),
    },
    taxi: {
      fixedFee: clamp(input?.taxi?.fixedFee, 0, 100, DEFAULT_SERVICE_COMMISSIONS.taxi.fixedFee),
      rate: clamp(input?.taxi?.rate, 0, 40, DEFAULT_SERVICE_COMMISSIONS.taxi.rate),
    },
  };
}

/**
 * Commission earned on one fulfilled job. Amounts are rounded to whole MAD to
 * match the cash ledger and admin payouts.
 */
export function serviceCommission(
  commissions: ServiceCommissions,
  service: ServiceCommissionId,
  base: number,
  includeFixed = true,
): number {
  const rule = commissions[service];
  const fixed = includeFixed ? rule.fixedFee : 0;
  return Math.round(fixed + (Math.max(0, base) * rule.rate) / 100);
}

/** Split a commission into its fixed and percentage parts for admin detail. */
export function serviceCommissionParts(
  commissions: ServiceCommissions,
  service: ServiceCommissionId,
  base: number,
  includeFixed = true,
) {
  const rule = commissions[service];
  const fixed = includeFixed ? rule.fixedFee : 0;
  const percent = Math.round((Math.max(0, base) * rule.rate) / 100);
  return { fixed, percent, total: fixed + percent };
}
