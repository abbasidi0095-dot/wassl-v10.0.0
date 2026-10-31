import { NextResponse } from "next/server";
import { updateDriverAdmin } from "@/lib/db";
import { actorFromSession, isResponse, requireApiRole } from "@/lib/api-auth";
import type { Driver } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: Driver["status"][] = ["offline", "available", "busy"];

export async function PATCH(request: Request) {
  const session = requireApiRole(request, ["admin"]);
  if (isResponse(session)) return session;

  const body = (await request.json().catch(() => null)) as
    | {
        driverId?: string;
        active?: boolean;
        vehicle?: string;
        plate?: string;
        phone?: string;
        kind?: Driver["kind"];
        photo?: string;
        cashLimit?: number;
        resetCash?: boolean;
        status?: string;
      }
    | null;
  if (!body?.driverId) {
    return NextResponse.json({ error: "driverId is required" }, { status: 400 });
  }
  if (body.status && !STATUSES.includes(body.status as Driver["status"])) {
    return NextResponse.json({ error: "Invalid driver status" }, { status: 400 });
  }

  try {
    const driver = await updateDriverAdmin(
      body.driverId,
      {
        active: typeof body.active === "boolean" ? body.active : undefined,
        vehicle: body.vehicle,
        plate: body.plate,
        phone: body.phone,
        kind: body.kind,
        photo: body.photo,
        cashLimit:
          body.cashLimit === undefined || body.cashLimit === null
            ? undefined
            : Number(body.cashLimit),
        resetCash: body.resetCash === true,
        status: body.status as Driver["status"] | undefined,
      },
      actorFromSession(session),
    );
    return NextResponse.json({ ok: true, driver });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update the driver" },
      { status: 400 },
    );
  }
}
