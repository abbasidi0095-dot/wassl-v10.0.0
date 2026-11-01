import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sendPushTest } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as
    | { delaySeconds?: number }
    | null;
  const delay = Math.max(0, Math.min(20, Number(body?.delaySeconds) || 0));
  if (delay > 0) {
    // The browser may be locked or backgrounded while this finishes; iOS can
    // then show the notification in Notification Center.
    await new Promise((resolve) => setTimeout(resolve, delay * 1000));
  }
  const sent = await sendPushTest({
    email: session.email,
    userId: session.userId,
    locale: session.role === "customer" ? "en" : "en",
  });
  return NextResponse.json({ ok: true, sent });
}
