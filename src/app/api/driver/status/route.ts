import { NextResponse } from "next/server";
import { setDriverStatus } from "@/lib/db";
import { actorFromSession, isResponse, requireApiRole } from "@/lib/api-auth";
import { OrderRuleError } from "@/lib/order-machine";
import type { DriverStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = requireApiRole(request, ["driver"]);
  if (isResponse(session)) return session;
  if (!session.driverId) {
    return NextResponse.json({ error: "Driver profile missing" }, { status: 400 });
  }
  const body = (await request.json().catch(() => null)) as
    | { status?: DriverStatus }
    | null;
  if (!body?.status || !["offline", "available", "busy"].includes(body.status)) {
    return NextResponse.json({ error: "Invalid driver status" }, { status: 400 });
  }
  try {
    const driver = await setDriverStatus(
      session.driverId,
      body.status,
      actorFromSession(session),
    );
    return NextResponse.json({ ok: true, driver });
  } catch (error) {
    if (error instanceof OrderRuleError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === "active_delivery" ? 409 : 400 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update status" },
      { status: 400 },
    );
  }
}
