import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sendPushTest } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  }
  const sent = await sendPushTest({
    email: session.email,
    userId: session.userId,
    locale: session.role === "customer" ? "en" : "en",
  });
  return NextResponse.json({ ok: true, sent });
}
