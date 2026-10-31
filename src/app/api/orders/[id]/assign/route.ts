import { NextResponse } from "next/server";
import { assignDriver, autoAssignOrder, getOrder } from "@/lib/db";
import { actorFromSession, isResponse, requireApiRole } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = requireApiRole(request, ["admin"]);
  if (isResponse(session)) return session;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as
    | { driverId?: string; auto?: boolean }
    | null;
  const order = await getOrder(id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  try {
    const updated = body?.auto
      ? await autoAssignOrder(order.id, actorFromSession(session))
      : body?.driverId
        ? await assignDriver(order.id, body.driverId, actorFromSession(session))
        : null;
    if (!updated) {
      return NextResponse.json({ error: "Choose a driver or use auto-assign" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, order: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not assign driver" },
      { status: 400 },
    );
  }
}
