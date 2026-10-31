import { NextResponse } from "next/server";
import { actorFromSession, isResponse, requireApiRole } from "@/lib/api-auth";
import { updateTaxiRideStatus } from "@/lib/db";
import { notifyTaxiPush } from "@/lib/push";
import type { TaxiStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: TaxiStatus[] = [
  "accepted",
  "arriving",
  "in_progress",
  "completed",
  "cancelled",
];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = requireApiRole(request, ["customer", "driver", "admin"]);
  if (isResponse(session)) return session;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as
    | { status?: string; proofCode?: string }
    | null;
  if (!body?.status || !STATUSES.includes(body.status as TaxiStatus)) {
    return NextResponse.json({ error: "A valid status is required" }, { status: 400 });
  }

  try {
    const ride = await updateTaxiRideStatus(
      id,
      body.status as TaxiStatus,
      actorFromSession(session),
      { proofCode: body.proofCode },
    );
    void notifyTaxiPush(ride);
    return NextResponse.json({ ok: true, ride });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update the ride" },
      { status: 400 },
    );
  }
}
