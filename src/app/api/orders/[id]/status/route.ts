import { NextResponse } from "next/server";
import { getOrder, getOrderView, updateOrderStatus, type OrderView } from "@/lib/db";
import { notifyOrderStatusChange } from "@/lib/email";
import { notifyOrderPush } from "@/lib/push";
import { isResponse, requireApiRole, actorFromSession } from "@/lib/api-auth";
import { OrderRuleError } from "@/lib/order-machine";
import type { OrderStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KNOWN_STATUSES: OrderStatus[] = [
  "placed",
  "accepted",
  "preparing",
  "ready",
  "assigned",
  "picked_up",
  "en_route",
  "delivered",
  "cancelled",
];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as
    | { status?: OrderStatus; note?: string }
    | null;
  if (!body?.status || !KNOWN_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "A valid status is required" }, { status: 400 });
  }

  const session = requireApiRole(request, ["admin", "merchant", "driver"]);
  if (isResponse(session)) return session;

  const order = await getOrder(id);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  try {
    const updated = await updateOrderStatus(order.id, body.status, actorFromSession(session), {
      note: body.note,
    });
    void notifyOrderStatusChange(
      updated as unknown as OrderView,
      updated.customerEmail,
    );
    void notifyOrderPush(updated);
    return NextResponse.json({ ok: true, order: updated });
  } catch (error) {
    if (error instanceof OrderRuleError) {
      const status =
        error.code === "not_found"
          ? 404
          : ["role_not_allowed", "wrong_store", "wrong_driver"].includes(error.code)
            ? 403
            : ["illegal_transition", "same_status"].includes(error.code)
              ? 409
              : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update order" },
      { status: 400 },
    );
  }
}
