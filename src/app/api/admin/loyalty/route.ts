import { NextResponse } from "next/server";
import { adjustLoyaltyPoints } from "@/lib/db";
import { actorFromSession, isResponse, requireApiRole } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const session = requireApiRole(request, ["admin"]);
  if (isResponse(session)) return session;
  const body = (await request.json().catch(() => null)) as
    | { userId?: string; points?: number; note?: string }
    | null;
  if (!body?.userId || typeof body.points !== "number") {
    return NextResponse.json(
      { error: "userId and points are required" },
      { status: 400 },
    );
  }
  try {
    const account = await adjustLoyaltyPoints(
      body.userId,
      body.points,
      body.note?.trim() || "",
      actorFromSession(session),
    );
    return NextResponse.json({ ok: true, account });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not adjust points" },
      { status: 400 },
    );
  }
}
