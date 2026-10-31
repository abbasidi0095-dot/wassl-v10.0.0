import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { removePushSubscription, savePushSubscription } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
  locale?: string;
};

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as Body | null;
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  await savePushSubscription({
    endpoint,
    p256dh,
    auth,
    email: session.email,
    userId: session.userId,
    locale: body?.locale,
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => null)) as { endpoint?: string } | null;
  if (!body?.endpoint) {
    return NextResponse.json({ error: "endpoint is required" }, { status: 400 });
  }
  await removePushSubscription(body.endpoint);
  return NextResponse.json({ ok: true });
}
