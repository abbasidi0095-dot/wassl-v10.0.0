import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { updateServiceBookingStatus } from "@/lib/db";
import type { ServiceBookingStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: ServiceBookingStatus[] = ["confirmed", "completed", "cancelled"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as
    | { status?: ServiceBookingStatus; accessCode?: string }
    | null;
  if (!body?.status || !STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Choose a valid status" }, { status: 400 });
  }
  const { id } = await params;
  try {
    const booking = await updateServiceBookingStatus(
      id,
      body.status,
      { role: session.role, id: session.userId, name: session.name },
      { accessCode: body.accessCode },
    );
    return NextResponse.json({ ok: true, booking });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update the booking" },
      { status: 400 },
    );
  }
}
