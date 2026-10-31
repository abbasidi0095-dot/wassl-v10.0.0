import type { Order, OrderStatus, Role } from "./types";

/**
 * Who performed an action. Routes build this from the signed session, never
 * from the request body, so an actor cannot claim another role.
 */
export type OrderActor = {
  role: Role | "customer" | "system";
  id?: string;
  name?: string;
  storeId?: string;
  driverId?: string;
};

export type TransitionRule = {
  to: OrderStatus;
  /** Roles allowed to perform this exact step. */
  roles: OrderActor["role"][];
  /** Human label used by dashboards and the audit trail. */
  action: string;
  /** The order must already have a driver (pickup, delivery). */
  requiresDriver?: boolean;
  /** Cancelling requires a written reason. */
  requiresReason?: boolean;
  /** Free-text hint shown in the UI when the step is unavailable. */
  description: string;
};

const ALL_STAFF: OrderActor["role"][] = ["admin"];

/**
 * The only legal status graph. Anything not listed here is rejected by the
 * server, including admin requests, so the timeline can never lie.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, TransitionRule[]> = {
  placed: [
    {
      to: "accepted",
      roles: ["merchant", ...ALL_STAFF],
      action: "accept",
      description: "Store confirms it can prepare the order",
    },
    {
      to: "cancelled",
      roles: ["merchant", ...ALL_STAFF],
      action: "cancel",
      requiresReason: true,
      description: "Store cancels before preparation starts",
    },
  ],
  accepted: [
    {
      to: "preparing",
      roles: ["merchant", ...ALL_STAFF],
      action: "start_preparing",
      description: "Kitchen starts preparing the order",
    },
    {
      to: "cancelled",
      roles: ["merchant", ...ALL_STAFF],
      action: "cancel",
      requiresReason: true,
      description: "Store cancels before the food is ready",
    },
  ],
  preparing: [
    {
      to: "ready",
      roles: ["merchant", ...ALL_STAFF],
      action: "mark_ready",
      description: "Order is packed and waiting for a driver",
    },
    {
      to: "cancelled",
      roles: ["merchant", ...ALL_STAFF],
      action: "cancel",
      requiresReason: true,
      description: "Store cancels before handover",
    },
  ],
  ready: [
    {
      to: "assigned",
      // Drivers can claim a ready order for themselves; dispatch can still
      // assign one explicitly. DB-level checks verify the driver and city.
      roles: ["driver", "admin", "system"],
      action: "assign_driver",
      description: "A driver is dispatched to the store",
    },
    {
      to: "cancelled",
      roles: ["merchant", ...ALL_STAFF],
      action: "cancel",
      requiresReason: true,
      description: "Cancel while the order is still at the store",
    },
  ],
  assigned: [
    {
      to: "picked_up",
      roles: ["driver", ...ALL_STAFF],
      action: "pick_up",
      requiresDriver: true,
      description: "Driver confirms custody of the order",
    },
    {
      to: "ready",
      roles: ["admin"],
      action: "unassign_driver",
      description: "Release the driver and return the order to the store",
    },
    {
      to: "cancelled",
      roles: ["admin"],
      action: "cancel",
      requiresReason: true,
      description: "Operations cancels after dispatch",
    },
  ],
  picked_up: [
    {
      to: "en_route",
      roles: ["driver", ...ALL_STAFF],
      action: "start_delivery",
      requiresDriver: true,
      description: "Driver leaves the store",
    },
    {
      to: "cancelled",
      roles: ["admin"],
      action: "cancel",
      requiresReason: true,
      description: "Operations cancels during delivery",
    },
  ],
  en_route: [
    {
      to: "delivered",
      roles: ["driver", ...ALL_STAFF],
      action: "deliver",
      requiresDriver: true,
      description: "Cash collected and order handed over",
    },
    {
      to: "cancelled",
      roles: ["admin"],
      action: "cancel",
      requiresReason: true,
      description: "Operations cancels during the last mile",
    },
  ],
  delivered: [],
  cancelled: [],
};

export const ACTIVE_STATUSES: OrderStatus[] = [
  "placed",
  "accepted",
  "preparing",
  "ready",
  "assigned",
  "picked_up",
  "en_route",
];

export const TERMINAL_STATUSES: OrderStatus[] = ["delivered", "cancelled"];

export function isTerminal(status: OrderStatus) {
  return TERMINAL_STATUSES.includes(status);
}

export function transitionFor(
  from: OrderStatus,
  to: OrderStatus,
): TransitionRule | undefined {
  return ORDER_TRANSITIONS[from]?.find((rule) => rule.to === to);
}

/**
 * Role-aware list used by dashboards to render only the buttons that the
 * server will actually accept.
 */
export function availableTransitions(
  order: Pick<Order, "status" | "driverId" | "storeId">,
  actor: Pick<OrderActor, "role" | "storeId" | "driverId">,
): TransitionRule[] {
  return (ORDER_TRANSITIONS[order.status] ?? []).filter((rule) =>
    canAct(rule, order, actor),
  );
}

function canAct(
  rule: TransitionRule,
  order: Pick<Order, "status" | "driverId" | "storeId">,
  actor: Pick<OrderActor, "role" | "storeId" | "driverId">,
): boolean {
  if (!rule.roles.includes(actor.role)) return false;
  if (actor.role === "merchant" && actor.storeId !== order.storeId) return false;
  if (rule.requiresDriver && !order.driverId) return false;
  if (
    actor.role === "driver" &&
    order.driverId &&
    actor.driverId !== order.driverId
  ) {
    return false;
  }
  return true;
}

export type TransitionCheck =
  | { ok: true; rule: TransitionRule }
  | { ok: false; code: string; error: string };

export class OrderRuleError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "OrderRuleError";
    this.code = code;
  }
}


/**
 * Server-side authority for every status change. Returns a stable error code
 * so API routes can answer 400/403 without duplicating the rules.
 */
export function checkTransition(
  order: Pick<Order, "status" | "driverId" | "storeId">,
  next: OrderStatus,
  actor: OrderActor,
  options: { note?: string } = {},
): TransitionCheck {
  if (order.status === next) {
    return { ok: false, code: "same_status", error: "Order is already in that state" };
  }
  const rule = transitionFor(order.status, next);
  if (!rule) {
    return {
      ok: false,
      code: "illegal_transition",
      error: `Cannot move an order from ${order.status} to ${next}`,
    };
  }
  if (!rule.roles.includes(actor.role)) {
    return {
      ok: false,
      code: "role_not_allowed",
      error: `A ${actor.role} cannot ${rule.action.replace(/_/g, " ")} this order`,
    };
  }
  if (actor.role === "merchant" && actor.storeId !== order.storeId) {
    return { ok: false, code: "wrong_store", error: "This order belongs to another store" };
  }
  if (rule.requiresDriver && !order.driverId) {
    return { ok: false, code: "driver_required", error: "Assign a driver first" };
  }
  if (
    actor.role === "driver" &&
    order.driverId &&
    actor.driverId !== order.driverId
  ) {
    return { ok: false, code: "wrong_driver", error: "This order is not assigned to you" };
  }
  if (rule.requiresReason && (options.note ?? "").trim().length < 3) {
    return {
      ok: false,
      code: "reason_required",
      error: "Add a short reason so the customer and the audit trail can see why",
    };
  }
  return { ok: true, rule };
}

/** Order of the happy path, used for the progress bar on the tracking page. */
export const ORDER_PROGRESS: OrderStatus[] = [
  "placed",
  "accepted",
  "preparing",
  "ready",
  "assigned",
  "picked_up",
  "en_route",
  "delivered",
];

export function progressIndex(status: OrderStatus): number {
  if (status === "cancelled") return -1;
  return ORDER_PROGRESS.indexOf(status);
}
