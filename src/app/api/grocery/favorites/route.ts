import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { toggleFavorite } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "customer") {
    return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as
    | { productId?: string }
    | null;
  if (!body?.productId) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 });
  }
  try {
    const favorites = await toggleFavorite(session.userId, body.productId);
    return NextResponse.json({ ok: true, favorites });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update favourites" },
      { status: 400 },
    );
  }
}
