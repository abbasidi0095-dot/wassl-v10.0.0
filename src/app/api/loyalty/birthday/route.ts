import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { getLoyaltyOverview, setLoyaltyBirthday } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session || session.role !== "customer") {
    return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as
    | { birthday?: string }
    | null;
  if (!body?.birthday) {
    return NextResponse.json({ error: "birthday is required" }, { status: 400 });
  }
  try {
    await setLoyaltyBirthday(session.userId, body.birthday);
    return NextResponse.json({ ok: true, overview: await getLoyaltyOverview(session.userId) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save the birthday" },
      { status: 400 },
    );
  }
}
