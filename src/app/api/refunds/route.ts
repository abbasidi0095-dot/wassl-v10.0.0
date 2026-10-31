import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createRefundRequest, getRefundRequests } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  if (session.role !== "admin" && !session.email) {
    return NextResponse.json({ error: "Please sign in" }, { status: 403 });
  }
  const requests = await getRefundRequests(
    session.role === "admin" ? undefined : { customerEmail: session.email },
  );
  return NextResponse.json({ requests });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as
    | { orderId?: string; reason?: string; productIds?: string[]; restock?: boolean }
    | null;
  if (!body?.orderId || !body.reason?.trim()) {
    return NextResponse.json({ error: "Order and reason are required" }, { status: 400 });
  }
  if (session.role !== "admin" && !session.email) {
    return NextResponse.json({ error: "Please sign in" }, { status: 403 });
  }
  try {
    const refund = await createRefundRequest({
      orderId: body.orderId,
      reason: body.reason,
      productIds: body.productIds,
      restock: body.restock,
      customerEmail: session.role === "admin" ? undefined : session.email,
    });
    return NextResponse.json({ ok: true, refund }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not request a refund" },
      { status: 400 },
    );
  }
}
