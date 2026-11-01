import type {
  LoyaltyAccount,
  LoyaltyReward,
  LoyaltyTier,
  LoyaltyTransaction,
  Order,
  Store,
} from "./types";
import { grocerySettings } from "./grocery";

export const LOYALTY_PLUS_THRESHOLD = 500;
export const LOYALTY_PREMIUM_THRESHOLD = 2000;

export const LOYALTY_TIERS: Array<{
  id: LoyaltyTier;
  label: string;
  threshold: number;
  multiplier: number;
}> = [
  { id: "basic", label: "Basic", threshold: 0, multiplier: 1 },
  { id: "plus", label: "Plus", threshold: LOYALTY_PLUS_THRESHOLD, multiplier: 1.1 },
  { id: "premium", label: "Premium", threshold: LOYALTY_PREMIUM_THRESHOLD, multiplier: 1.2 },
];

export const DEFAULT_LOYALTY_REWARDS: LoyaltyReward[] = [
  {
    id: "reward_credit_10",
    title: "10 MAD grocery credit",
    description: "Use 100 points for 10 MAD off a grocery order.",
    pointsCost: 100,
    kind: "grocery_credit",
    value: 10,
    active: true,
  },
  {
    id: "reward_credit_25",
    title: "25 MAD grocery credit",
    description: "Use 250 points for 25 MAD off a grocery order.",
    pointsCost: 250,
    kind: "grocery_credit",
    value: 25,
    active: true,
  },
  {
    id: "reward_delivery",
    title: "Free delivery",
    description: "Use 150 points for free delivery on a grocery order.",
    pointsCost: 150,
    kind: "delivery",
    value: 0,
    active: true,
  },
];

export function tierForLifetime(points: number): LoyaltyTier {
  if (points >= LOYALTY_PREMIUM_THRESHOLD) return "premium";
  if (points >= LOYALTY_PLUS_THRESHOLD) return "plus";
  return "basic";
}

export function tierInfo(tier: LoyaltyTier) {
  return LOYALTY_TIERS.find((entry) => entry.id === tier) ?? LOYALTY_TIERS[0];
}

export function nextTierInfo(lifetimePoints: number) {
  return LOYALTY_TIERS.find((entry) => entry.threshold > lifetimePoints) ?? null;
}

export function tierProgress(lifetimePoints: number): {
  tier: LoyaltyTier;
  next: (typeof LOYALTY_TIERS)[number] | null;
  currentThreshold: number;
  nextThreshold: number | null;
  percent: number;
  pointsToNext: number;
} {
  const tier = tierForLifetime(lifetimePoints);
  const current = tierInfo(tier);
  const next = nextTierInfo(lifetimePoints);
  const percent = next
    ? Math.min(
        100,
        Math.max(
          0,
          Math.round(
            ((lifetimePoints - current.threshold) /
              (next.threshold - current.threshold)) *
              100,
          ),
        ),
      )
    : 100;
  return {
    tier,
    next,
    currentThreshold: current.threshold,
    nextThreshold: next?.threshold ?? null,
    percent,
    pointsToNext: next ? Math.max(0, next.threshold - lifetimePoints) : 0,
  };
}

/** Central earning rule: grocery rate is store-configured; food uses 1 per 20 MAD. */
export function pointsForOrder(order: Order, store?: Store): number {
  if (order.status === "cancelled") return 0;
  if (store?.category === "grocery") {
    const rate = Math.max(0, grocerySettings(store).loyaltyPointsPer10Mad);
    return Math.floor(order.subtotal / 10) * rate;
  }
  return Math.floor(order.subtotal / 20);
}

export function tierMultiplier(tier: LoyaltyTier): number {
  return tierInfo(tier).multiplier;
}

export function makeReferralCode(userId: string): string {
  const suffix = userId.replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase();
  return `WSL-${suffix || "MEMBER"}`;
}

export function loyaltyBalance(account: LoyaltyAccount | undefined): number {
  return Math.max(0, account?.points ?? 0);
}

export function transactionLabel(transaction: LoyaltyTransaction): string {
  switch (transaction.type) {
    case "earn":
      return "Points earned";
    case "redeem":
      return "Points redeemed";
    case "refund":
      return "Points returned";
    case "adjust":
      return transaction.note || "Admin adjustment";
    case "referral":
      return "Referral reward";
    case "birthday":
      return "Birthday reward";
    case "campaign":
      return "Campaign bonus";
    default:
      return "Points update";
  }
}
