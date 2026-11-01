import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import {
  getChatMessages,
  getChatThread,
  markChatThreadRead,
  setChatThreadStatus,
} from "@/lib/db";
import type { ChatThreadStatus } from "@/lib/types";

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
  return NextResponse.json({ thread, messages });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as
    | { status?: ChatThreadStatus }
    | null;
  if (
    body?.status !== "open" &&
    body?.status !== "waiting" &&
    body?.status !== "closed"
  ) {
    return NextResponse.json({ error: "Choose a valid status" }, { status: 400 });
  }
  const { id } = await params;
  try {
    const thread = await setChatThreadStatus(id, body.status, session);
    return NextResponse.json({ ok: true, thread });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update the conversation" },
      { status: 400 },
    );
  }
}
