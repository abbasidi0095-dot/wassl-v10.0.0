import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { createBusinessOrder, getBusinessOrders } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session || session.role !== "customer") {
    return NextResponse.json({ orders: [] });
  }
  return NextResponse.json({ orders: await getBusinessOrders({ customerId: session.userId }) });
}

export async function POST(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session || session.role !== "customer") {
    return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as
    | {
        storeId?: string;
        deliveryDate?: string;
        notes?: string;
        items?: Array<{ productId?: string; qty?: number }>;
      }
    | null;
  const items = (body?.items ?? [])
    .map((line) => ({ productId: line.productId ?? "", qty: Number(line.qty ?? 0) }))
    .filter((line) => line.productId && line.qty > 0);
  if (!body?.storeId || !items.length || !body.deliveryDate) {
    return NextResponse.json({ error: "Store, items and delivery date are required" }, { status: 400 });
  }
  try {
    const order = await createBusinessOrder(
      { storeId: body.storeId, items, deliveryDate: body.deliveryDate, notes: body.notes },
      { role: "customer", id: session.userId, name: session.name },
    );
    return NextResponse.json({ ok: true, order }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create the order" },
      { status: 400 },
    );
  }
}
