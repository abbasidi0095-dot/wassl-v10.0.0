import { NextResponse } from "next/server";
import { getDb, updateProduct } from "@/lib/db";
import { actorFromSession, isResponse, requireApiRole } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = requireApiRole(request, ["merchant", "admin"]);
  if (isResponse(session)) return session;
  const { id } = await params;
  const product = (await getDb()).products.find((item) => item.id === id);
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  if (session.role === "merchant" && product.storeId !== session.storeId) {
    return NextResponse.json({ error: "This product belongs to another store" }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as
    | { available?: boolean }
    | null;
  if (typeof body?.available !== "boolean") {
    return NextResponse.json({ error: "available is required" }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    product: await updateProduct(id, body.available, actorFromSession(session)),
  });
}
