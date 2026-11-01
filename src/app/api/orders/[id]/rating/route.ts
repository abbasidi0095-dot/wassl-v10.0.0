import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { rateOrder } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as
    | { stars?: number; comment?: string }
    | null;
  if (typeof body?.stars !== "number") {
    return NextResponse.json({ error: "Choose a rating" }, { status: 400 });
  }
  const { id } = await params;
  try {
    const order = await rateOrder(id, session, body.stars, body.comment);
    return NextResponse.json({ ok: true, rating: order.rating });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save the rating" },
      { status: 400 },
    );
  }
}
