import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import {
  addChatMessage,
  getChatMessages,
  getChatThread,
  markChatThreadRead,
} from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const { id } = await params;
  const thread = await getChatThread(id, session);
  if (!thread) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  const messages = await getChatMessages(id, session);
  await markChatThreadRead(id, session);
  return NextResponse.json({ messages });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { body?: string } | null;
  if (!body?.body?.trim()) {
    return NextResponse.json({ error: "Write a message first" }, { status: 400 });
  }
  const { id } = await params;
  try {
    const message = await addChatMessage(id, session, body.body);
    return NextResponse.json({ ok: true, message }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not send the message" },
      { status: 400 },
    );
  }
}
