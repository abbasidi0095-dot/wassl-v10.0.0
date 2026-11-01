import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { claimLoyaltyReferral, getLoyaltyOverview } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session || session.role !== "customer") {
    return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as
    | { code?: string }
    | null;
  if (!body?.code?.trim()) {
    return NextResponse.json({ error: "Enter a referral code" }, { status: 400 });
  }
  try {
    await claimLoyaltyReferral(session.userId, body.code);
    return NextResponse.json({ ok: true, overview: await getLoyaltyOverview(session.userId) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not claim the referral" },
      { status: 400 },
    );
  }
}
