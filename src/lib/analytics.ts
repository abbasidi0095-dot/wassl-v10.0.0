import type {
  Order,
  Role,
  Store,
  TaxiRide,
} from "./types";

export const PROFIT_RULES = {
  delivery: 5,
  taxi: 2,
  groceryRate: 0.05,
} as const;

export type AnalyticsDay = {
  key: string;
  label: string;
  orders: number;
  rides: number;
  groceryOrders: number;
  gmv: number;
  profit: number;
  deliveryProfit: number;
  taxiProfit: number;
  groceryProfit: number;
};

export type ProfitEvent = {
  id: string;
  label: string;
  note: string;
  at: string;
  profit: number;
  kind: "delivery" | "taxi" | "grocery";
};

export type AdminAnalytics = {
  deliveredOrders: number;
  completedRides: number;
  groceryOrders: number;
  gmv: number;
  averageOrder: number;
  profit: {
    total: number;
    delivery: number;
    taxi: number;
    grocery: number;
    grocerySales: number;
  };
  days: AnalyticsDay[];
  topStores: { id: string; name: string; citySlug: string; orders: number; gmv: number }[];
  signups: { customers: number; merchants: number; drivers: number; admins: number };
  recent: ProfitEvent[];
};

function dayKey(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

function shortDay(key: string) {
  const date = new Date(`${key}T12:00:00Z`);
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

export function computeAnalytics(
  orders: Order[],
  rides: TaxiRide[],
  stores: Store[],
  users: { role: Role; createdAt?: string }[],
  days = 14,
): AdminAnalytics {
  const storeMap = new Map(stores.map((store) => [store.id, store]));
  const delivered = orders.filter((order) => order.status === "delivered");
  const completed = rides.filter((ride) => ride.status === "completed");

  let deliveryProfit = 0;
  let taxiProfit = 0;
  let grocerySales = 0;
  let gmv = 0;
  let groceryOrders = 0;

  for (const order of delivered) {
    gmv += order.total;
    const store = storeMap.get(order.storeId);
    const isGrocery = store?.category === "grocery";
    if (order.fulfillment !== "pickup") {
      deliveryProfit += PROFIT_RULES.delivery;
    }
    if (isGrocery) {
      groceryOrders += 1;
      grocerySales += order.subtotal;
    }
  }
  for (const ride of completed) {
    gmv += ride.fare;
    taxiProfit += PROFIT_RULES.taxi;
  }
  const groceryProfit = grocerySales * PROFIT_RULES.groceryRate;

  const today = new Date();
  const dayMap = new Map<string, AnalyticsDay>();
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - index);
    const key = date.toISOString().slice(0, 10);
    dayMap.set(key, {
      key,
      label: shortDay(key),
      orders: 0,
      rides: 0,
      groceryOrders: 0,
      gmv: 0,
      profit: 0,
      deliveryProfit: 0,
      taxiProfit: 0,
      groceryProfit: 0,
    });
  }

  const recent: ProfitEvent[] = [];
  for (const order of delivered) {
    const at = order.deliveredAt ?? order.updatedAt ?? order.createdAt;
    const key = dayKey(at);
    const store = storeMap.get(order.storeId);
    const isGrocery = store?.category === "grocery";
    const delivery = order.fulfillment !== "pickup" ? PROFIT_RULES.delivery : 0;
    const grocery = isGrocery ? order.subtotal * PROFIT_RULES.groceryRate : 0;
    const profit = delivery + grocery;
    const day = dayMap.get(key);
    if (day) {
      day.orders += 1;
      day.gmv += order.total;
      day.profit += profit;
      day.deliveryProfit += delivery;
      day.groceryProfit += grocery;
      if (isGrocery) day.groceryOrders += 1;
    }
    if (profit > 0) {
      recent.push({
        id: order.id,
        label: store?.name ?? order.code,
        note: isGrocery ? "Grocery · 5% + delivery" : `Delivery · ${order.code}`,
        at,
        profit,
        kind: isGrocery ? "grocery" : "delivery",
      });
    }
  }
  for (const ride of completed) {
    const at = ride.completedAt ?? ride.updatedAt ?? ride.createdAt;
    const day = dayMap.get(dayKey(at));
    if (day) {
      day.rides += 1;
      day.gmv += ride.fare;
      day.profit += PROFIT_RULES.taxi;
      day.taxiProfit += PROFIT_RULES.taxi;
    }
    recent.push({
      id: ride.id,
      label: `${ride.pickupLabel} → ${ride.dropoffLabel}`,
      note: `Taxi · ${ride.citySlug}`,
      at,
      profit: PROFIT_RULES.taxi,
      kind: "taxi",
    });
  }
  recent.sort((a, b) => b.at.localeCompare(a.at));

  const topMap = new Map<
    string,
    { id: string; name: string; citySlug: string; orders: number; gmv: number }
  >();
  for (const order of delivered) {
    const store = storeMap.get(order.storeId);
    if (!store) continue;
    const row = topMap.get(store.id) ?? {
      id: store.id,
      name: store.name,
      citySlug: store.citySlug,
      orders: 0,
      gmv: 0,
    };
    row.orders += 1;
    row.gmv += order.total;
    topMap.set(store.id, row);
  }

  return {
    deliveredOrders: delivered.length,
    completedRides: completed.length,
    groceryOrders,
    gmv,
    averageOrder: delivered.length ? gmv / delivered.length : 0,
    profit: {
      total: deliveryProfit + taxiProfit + groceryProfit,
      delivery: deliveryProfit,
      taxi: taxiProfit,
      grocery: groceryProfit,
      grocerySales,
    },
    days: [...dayMap.values()],
    topStores: [...topMap.values()].sort((a, b) => b.gmv - a.gmv).slice(0, 6),
    signups: {
      customers: users.filter((user) => user.role === "customer").length,
      merchants: users.filter((user) => user.role === "merchant").length,
      drivers: users.filter((user) => user.role === "driver").length,
      admins: users.filter((user) => user.role === "admin").length,
    },
    recent: recent.slice(0, 8),
  };
}
