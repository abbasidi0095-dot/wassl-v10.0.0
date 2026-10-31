import { describe, expect, it } from "vitest";
import {
  availableTransitions,
  checkTransition,
  ORDER_TRANSITIONS,
  progressIndex,
  type OrderActor,
} from "@/lib/order-machine";
import type { Order } from "@/lib/types";

const baseOrder = {
  id: "order_test",
  status: "placed" as Order["status"],
  driverId: undefined,
  storeId: "store_a",
};

const merchant: OrderActor = {
  role: "merchant",
  id: "user_merchant",
  storeId: "store_a",
};
const otherMerchant: OrderActor = {
  role: "merchant",
  id: "user_merchant_b",
  storeId: "store_b",
};
const admin: OrderActor = { role: "admin", id: "user_admin" };
const driver: OrderActor = {
  role: "driver",
  id: "user_driver",
  driverId: "driver_a",
};

describe("order state machine", () => {
  it("allows the merchant to accept its own new order", () => {
    const check = checkTransition(baseOrder, "accepted", merchant);
    expect(check.ok).toBe(true);
    if (check.ok) expect(check.rule.action).toBe("accept");
  });

  it("blocks a merchant acting on another store's order", () => {
    const check = checkTransition(baseOrder, "accepted", otherMerchant);
    expect(check).toMatchObject({ ok: false, code: "wrong_store" });
  });

  it("refuses unknown jumps even for an admin", () => {
    const check = checkTransition(baseOrder, "delivered", admin);
    expect(check).toMatchObject({ ok: false, code: "illegal_transition" });
  });

  it("refuses to skip preparation", () => {
    const check = checkTransition(
      { ...baseOrder, status: "accepted" },
      "ready",
      merchant,
    );
    expect(check).toMatchObject({ ok: false, code: "illegal_transition" });
  });

  it("requires a driver before pickup", () => {
    const check = checkTransition(
      { ...baseOrder, status: "assigned" },
      "picked_up",
      driver,
    );
    expect(check).toMatchObject({ ok: false, code: "driver_required" });
  });

  it("blocks a driver who is not assigned to the order", () => {
    const check = checkTransition(
      { ...baseOrder, status: "assigned", driverId: "driver_other" },
      "picked_up",
      driver,
    );
    expect(check).toMatchObject({ ok: false, code: "wrong_driver" });
  });

  it("requires a written reason for cancellation", () => {
    const check = checkTransition(baseOrder, "cancelled", merchant);
    expect(check).toMatchObject({ ok: false, code: "reason_required" });

    const withReason = checkTransition(baseOrder, "cancelled", merchant, {
      note: "Out of ingredients",
    });
    expect(withReason.ok).toBe(true);
  });

  it("treats delivered and cancelled as terminal", () => {
    expect(ORDER_TRANSITIONS.delivered).toHaveLength(0);
    expect(ORDER_TRANSITIONS.cancelled).toHaveLength(0);
    expect(
      checkTransition({ ...baseOrder, status: "cancelled" }, "accepted", admin),
    ).toMatchObject({ ok: false, code: "illegal_transition" });
  });

  it("only offers the buttons the server would accept", () => {
    const ready = { ...baseOrder, status: "ready" as const };
    expect(availableTransitions(ready, merchant).map((rule) => rule.to)).toEqual([
      "cancelled",
    ]);
    expect(availableTransitions(ready, admin).map((rule) => rule.to)).toEqual([
      "assigned",
      "cancelled",
    ]);
    expect(availableTransitions(ready, driver).map((rule) => rule.to)).toEqual([
      "assigned",
    ]);
  });

  it("lets a driver claim a ready order for themselves", () => {
    const check = checkTransition(
      { ...baseOrder, status: "ready" },
      "assigned",
      driver,
    );
    expect(check.ok).toBe(true);
    if (check.ok) expect(check.rule.action).toBe("assign_driver");
  });

  it("does not let an admin cancel a delivered order", () => {
    const check = checkTransition(
      { ...baseOrder, status: "delivered" },
      "cancelled",
      admin,
    );
    expect(check).toMatchObject({ ok: false, code: "illegal_transition" });
  });

  it("tracks progress through the happy path", () => {
    expect(progressIndex("placed")).toBe(0);
    expect(progressIndex("en_route")).toBe(6);
    expect(progressIndex("delivered")).toBe(7);
    expect(progressIndex("cancelled")).toBe(-1);
  });
});
