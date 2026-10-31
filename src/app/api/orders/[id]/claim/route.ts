import { NextResponse } from "next/server";
import {
  assignDriver,
  getDriver,
  getOrder,
  getOrderView,
} from "@/lib/db";
import { actorFromSession, isResponse, requireApiRole } from "@/lib/api-auth";
import { OrderRuleError } from "@/lib/order-machine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A driver claims a ready, unassigned order in their own city. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = requireApiRole(request, ["driver"]);
  if (isResponse(session)) return session;
  if (!session.driverId) {
    return NextResponse.json({ error: "Driver profile missing" }, { status: 400 });
  }

  const { id } = await params;
  const order = await getOrder(id);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.status !== "ready" || order.driverId) {
    return NextResponse.json(
      {
        error:
          order.driverId
            ? "Another driver already accepted this order"
            : "This order is not ready for a driver yet",
        code: order.driverId ? "already_assigned" : "not_ready",
      },
      { status: 409 },
    );
  }

  try {
    const updated = await assignDriver(
      order.id,
      session.driverId,
      actorFromSession(session),
    );
    return NextResponse.json({
      ok: true,
      order: await getOrderView(updated.id),
      driver: await getDriver(session.driverId),
    });
  } catch (error) {
    if (error instanceof OrderRuleError) {
      const status = ["wrong_driver", "wrong_city", "role_not_allowed"].includes(
        error.code,
      )
        ? 403
        : ["already_assigned", "driver_busy", "driver_offline", "illegal_transition"].includes(
              error.code,
            )
          ? 409
          : 400;
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not accept the order" },
      { status: 400 },
    );
  }
}
