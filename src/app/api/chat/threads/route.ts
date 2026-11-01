import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { createChatThread, getChatThreads } from "@/lib/db";
import type { ChatTopic } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOPICS: ChatTopic[] = [
  "support",
  "order",
  "ride",
  "delivery",
  "grocery",
  "account",
];

export async function GET(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const status = new URL(request.url).searchParams.get("status");
  const threads = await getChatThreads(session, {
    status:
      status === "open" || status === "waiting" || status === "closed"
        ? status
        : undefined,
  });
  return NextResponse.json({ threads });
}

export async function POST(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as
    | {
        topic?: ChatTopic;
        subject?: string;
        orderId?: string;
        rideId?: string;
        storeId?: string;
        driverId?: string;
        customerId?: string;
        customerEmail?: string;
        initialMessage?: string;
        aiEnabled?: boolean;
      }
    | null;
  if (!body?.topic || !TOPICS.includes(body.topic)) {
    return NextResponse.json({ error: "Choose a valid topic" }, { status: 400 });
  }
  try {
    const thread = await createChatThread(
      {
        topic: body.topic,
        subject: body.subject,
        orderId: body.orderId,
        rideId: body.rideId,
        storeId: body.storeId,
        driverId: body.driverId,
        // Customers cannot choose another customer; operations can.
        customerId: session.role === "admin" ? body.customerId : undefined,
        customerEmail: session.role === "admin" ? body.customerEmail : undefined,
        initialMessage: body.initialMessage,
        aiEnabled: body.aiEnabled,
      },
      session,
    );
    return NextResponse.json({ ok: true, thread }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start the conversation" },
      { status: 400 },
    );
  }
}
