import type {
  Order,
  Role,
  ServiceCommissionId,
  ServiceCommissions,
  Store,
  TaxiRide,
} from "./types";
import {
  normalizeServiceCommissions,
  serviceCommissionParts,
} from "./commissions";

export type AnalyticsDay = {
  key: string;
  label: string;
  orders: number;
  rides: number;
  groceryOrders: number;
  gmv: number;
  profit: number;
  foodProfit: number;
  taxiProfit: number;
  groceryProfit: number;
  pharmacyProfit: number;
};

export type ProfitEvent = {
  id: string;
  label: string;
  note: string;
  at: string;
  profit: number;
  kind: ServiceCommissionId;
};

export type ServiceProfit = {
  id: ServiceCommissionId;
  jobs: number;
  base: number;
  fixed: number;
  percent: number;
  earned: number;
};

export type AdminAnalytics = {
  deliveredOrders: number;
  completedRides: number;
  groceryOrders: number;
  gmv: number;
  averageOrder: number;
  profit: {
    total: number;
    food: number;
    taxi: number;
    grocery: number;
    pharmacy: number;
    foodSales: number;
    grocerySales: number;
    pharmacySales: number;
    taxiFares: number;
  };
  services: Record<ServiceCommissionId, ServiceProfit>;
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

function emptyService(id: ServiceCommissionId): ServiceProfit {
  return { id, jobs: 0, base: 0, fixed: 0, percent: 0, earned: 0 };
}

export function computeAnalytics(
  orders: Order[],
  rides: TaxiRide[],
  stores: Store[],
  users: { role: Role; createdAt?: string }[],
  commissions?: ServiceCommissions,
  days = 14,
): AdminAnalytics {
  const storeMap = new Map(stores.map((store) => [store.id, store]));
  const rules = normalizeServiceCommissions(commissions);
  const delivered = orders.filter((order) => order.status === "delivered");
  const completed = rides.filter((ride) => ride.status === "completed");

  const services: Record<ServiceCommissionId, ServiceProfit> = {
    food: emptyService("food"),
    grocery: emptyService("grocery"),
    pharmacy: emptyService("pharmacy"),
    taxi: emptyService("taxi"),
  };

  function addService(
    service: ServiceCommissionId,
    base: number,
    includeFixed: boolean,
  ) {
    const parts = serviceCommissionParts(rules, service, base, includeFixed);
    const row = services[service];
    row.jobs += 1;
    row.base += base;
    row.fixed += parts.fixed;
    row.percent += parts.percent;
    row.earned += parts.total;
    return parts;
  }

  function serviceForOrder(order: Order): ServiceCommissionId {
    const store = storeMap.get(order.storeId);
    if (store?.category === "grocery") return "grocery";
    if (store?.category === "pharmacy") return "pharmacy";
    return "food";
  }

  let gmv = 0;
  let groceryOrders = 0;

  for (const order of delivered) {
    gmv += order.total;
    const service = serviceForOrder(order);
    addService(service, order.subtotal, order.fulfillment !== "pickup");
    if (service === "grocery") groceryOrders += 1;
  }
  for (const ride of completed) {
    gmv += ride.fare;
    addService("taxi", ride.fare, true);
  }

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
      foodProfit: 0,
      taxiProfit: 0,
      groceryProfit: 0,
      pharmacyProfit: 0,
    });
  }

  const recent: ProfitEvent[] = [];
  for (const order of delivered) {
    const at = order.deliveredAt ?? order.updatedAt ?? order.createdAt;
    const key = dayKey(at);
    const store = storeMap.get(order.storeId);
    const service = serviceForOrder(order);
    const rule = rules[service];
    const parts = serviceCommissionParts(
      rules,
      service,
      order.subtotal,
      order.fulfillment !== "pickup",
    );
    const day = dayMap.get(key);
    if (day) {
      day.orders += 1;
      day.gmv += order.total;
      day.profit += parts.total;
      if (service === "food") day.foodProfit += parts.total;
      if (service === "grocery") {
        day.groceryProfit += parts.total;
        day.groceryOrders += 1;
      }
      if (service === "pharmacy") day.pharmacyProfit += parts.total;
    }
    if (parts.total > 0) {
      recent.push({
        id: order.id,
        label: store?.name ?? order.code,
        note:
          service === "food"
            ? `Food · ${parts.fixed} MAD + ${rule.rate}%`
            : service === "grocery"
              ? `Grocery · ${rule.rate}%`
              : `Pharmacy · ${rule.rate}%`,
        at,
        profit: parts.total,
        kind: service,
      });
    }
  }
  for (const ride of completed) {
    const at = ride.completedAt ?? ride.updatedAt ?? ride.createdAt;
    const day = dayMap.get(dayKey(at));
    const parts = serviceCommissionParts(rules, "taxi", ride.fare, true);
    if (day) {
      day.rides += 1;
      day.gmv += ride.fare;
      day.profit += parts.total;
      day.taxiProfit += parts.total;
    }
    if (parts.total > 0) {
      recent.push({
        id: ride.id,
        label: `${ride.pickupLabel} → ${ride.dropoffLabel}`,
        note: `Taxi · ${parts.fixed} MAD + ${rules.taxi.rate}%`,
        at,
        profit: parts.total,
        kind: "taxi",
      });
    }
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

  const foodProfit = services.food.earned;
  const groceryProfit = services.grocery.earned;
  const pharmacyProfit = services.pharmacy.earned;
  const taxiProfit = services.taxi.earned;

  return {
    deliveredOrders: delivered.length,
    completedRides: completed.length,
    groceryOrders,
    gmv,
    averageOrder: delivered.length ? gmv / delivered.length : 0,
    profit: {
      total: foodProfit + groceryProfit + pharmacyProfit + taxiProfit,
      food: foodProfit,
      taxi: taxiProfit,
      grocery: groceryProfit,
      pharmacy: pharmacyProfit,
      foodSales: services.food.base,
      grocerySales: services.grocery.base,
      pharmacySales: services.pharmacy.base,
      taxiFares: services.taxi.base,
    },
    services,
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
