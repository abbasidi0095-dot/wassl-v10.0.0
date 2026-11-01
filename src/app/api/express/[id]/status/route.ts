import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { updateParcelStatus } from "@/lib/db";
import type { ParcelStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: ParcelStatus[] = [
  "accepted",
  "picked_up",
  "in_transit",
  "delivered",
  "cancelled",
];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as
    | { status?: ParcelStatus; proofCode?: string; note?: string }
    | null;
  if (!body?.status || !STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Choose a valid status" }, { status: 400 });
  }
  const { id } = await params;
  try {
    const parcel = await updateParcelStatus(
      id,
      body.status,
      {
        role: session.role,
        id: session.userId,
        name: session.name,
        driverId: session.driverId,
      },
      { proofCode: body.proofCode, note: body.note },
    );
    return NextResponse.json({ ok: true, parcel });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update the parcel" },
      { status: 400 },
    );
  }
}
