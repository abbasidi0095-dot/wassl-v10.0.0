import { NextResponse } from "next/server";
import { getOrderView } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const order = await getOrderView(id);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  const session = getSessionFromRequest(_request);
  if (session?.role === "driver" || session?.role === "merchant") {
    const { deliveryPin, pickupCode, ...safe } = order;
    return NextResponse.json({
      order: { ...safe, handoverRequired: Boolean(deliveryPin) },
    });
  }
  return NextResponse.json({ order });
}
