import type { Database, Order } from "./types";

export type AlertSeverity = "critical" | "warning" | "info";

export type OperationalAlert = {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  href?: string;
  at?: string;
};

function minutesSince(iso: string | undefined, now: Date): number {
  if (!iso) return 0;
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return 0;
  return Math.max(0, Math.round((now.getTime() - time) / 60000));
}

function active(order: Order): boolean {
  return !["delivered", "cancelled"].includes(order.status);
}

/** Deterministic operational alerts from persisted state. */
export function operationalAlerts(
  db: Database,
  now = new Date(),
): OperationalAlert[] {
  const alerts: OperationalAlert[] = [];
  const drivers = new Map(db.drivers.map((driver) => [driver.id, driver]));
  const stores = new Map(db.stores.map((store) => [store.id, store]));

  for (const order of db.orders.filter(active)) {
    const store = stores.get(order.storeId);
    if (
      ["ready", "assigned"].includes(order.status) &&
      !order.driverId &&
      minutesSince(order.updatedAt, now) >= 15
    ) {
      alerts.push({
        id: `order-no-driver-${order.id}`,
        severity: "critical",
        title: `Order ${order.code} is waiting for a driver`,
        detail: `${store?.name ?? "Store"} · ${minutesSince(order.updatedAt, now)} min without a driver`,
        href: `/orders/${order.id}`,
        at: order.updatedAt,
      });
    }
    if (
      ["accepted", "preparing"].includes(order.status) &&
      minutesSince(order.updatedAt, now) >= 40
    ) {
      alerts.push({
        id: `order-stalled-${order.id}`,
        severity: "warning",
        title: `Order ${order.code} has not progressed`,
        detail: `${store?.name ?? "Store"} · ${minutesSince(order.updatedAt, now)} min in ${order.status}`,
        href: `/orders/${order.id}`,
        at: order.updatedAt,
      });
    }
    if (order.driverId && ["picked_up", "en_route"].includes(order.status)) {
      const driver = drivers.get(order.driverId);
      if (driver && driver.status === "offline") {
        alerts.push({
          id: `driver-offline-${order.id}`,
          severity: "critical",
          title: `Driver offline on ${order.code}`,
          detail: `${driver.name} is marked offline while the order is ${order.status}`,
          href: "/admin",
          at: order.updatedAt,
        });
      }
    }
  }

  for (const parcel of (db.parcels ?? []).filter((entry) =>
    ["requested", "accepted", "picked_up", "in_transit"].includes(entry.status),
  )) {
    if (
      parcel.status === "requested" &&
      minutesSince(parcel.createdAt, now) >= 20
    ) {
      alerts.push({
        id: `parcel-no-driver-${parcel.id}`,
        severity: "critical",
        title: `Parcel ${parcel.code} has no driver`,
        detail: `${parcel.pickupLabel} → ${parcel.dropoffLabel} · ${minutesSince(parcel.createdAt, now)} min`,
        href: `/express/${parcel.id}`,
        at: parcel.createdAt,
      });
    }
  }

  const lowStock = db.products.filter((product) => {
    const store = stores.get(product.storeId);
    if (store?.category !== "grocery" || !product.available) return false;
    const stock = product.variants?.length
      ? product.variants.reduce((sum, variant) => sum + variant.stock, 0)
      : product.stock;
    return typeof stock === "number" && stock > 0 && stock <= (product.lowStockThreshold ?? 5);
  });
  if (lowStock.length >= 3) {
    alerts.push({
      id: "grocery-low-stock",
      severity: "warning",
      title: `${lowStock.length} grocery products are low`,
      detail: "Review the restock suggestions in Grocery operations.",
      href: "/admin/grocery",
    });
  }

  const pendingRefunds = (db.refundRequests ?? []).filter(
    (refund) => refund.status === "pending",
  );
  if (pendingRefunds.length >= 3) {
    alerts.push({
      id: "refund-backlog",
      severity: "warning",
      title: `${pendingRefunds.length} refunds are waiting`,
      detail: "Approve, reject or refund them from Grocery operations.",
      href: "/admin/grocery",
    });
  }

  const cancelled24h = db.orders.filter(
    (order) =>
      order.status === "cancelled" &&
      now.getTime() - new Date(order.cancelledAt ?? order.updatedAt).getTime() <
        24 * 60 * 60 * 1000,
  );
  if (cancelled24h.length >= 5) {
    alerts.push({
      id: "cancellation-spike",
      severity: "warning",
      title: `${cancelled24h.length} orders cancelled in 24 hours`,
      detail: "Check store preparation times, driver supply and refund reasons.",
      href: "/admin/messages",
    });
  }

  const rank: Record<AlertSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };
  return alerts
    .sort((a, b) => rank[a.severity] - rank[b.severity])
    .slice(0, 12);
}
