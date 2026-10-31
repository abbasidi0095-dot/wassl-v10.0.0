import { NextResponse } from "next/server";
import { getDb, updateProductDetails, type UpdateProductInput } from "@/lib/db";
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
    | UpdateProductInput
    | null;
  if (!body || !Object.keys(body).length) {
    return NextResponse.json({ error: "No product changes supplied" }, { status: 400 });
  }
  try {
    return NextResponse.json({
      ok: true,
      product: await updateProductDetails(id, body, actorFromSession(session)),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update the product" },
      { status: 400 },
    );
  }
}
