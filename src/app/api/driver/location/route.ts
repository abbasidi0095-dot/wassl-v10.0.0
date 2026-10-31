import { NextResponse } from "next/server";
import { updateDriverLocation } from "@/lib/db";
import { isResponse, requireApiRole } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = requireApiRole(request, ["driver"]);
  if (isResponse(session)) return session;
  if (!session.driverId) {
    return NextResponse.json({ error: "Driver profile missing" }, { status: 400 });
  }
  const body = (await request.json().catch(() => null)) as
    | { lat?: number; lng?: number }
    | null;
  if (
    typeof body?.lat !== "number" ||
    typeof body?.lng !== "number" ||
    Math.abs(body.lat) > 90 ||
    Math.abs(body.lng) > 180
  ) {
    return NextResponse.json({ error: "Valid coordinates are required" }, { status: 400 });
  }
  const driver = await updateDriverLocation(session.driverId, body.lat, body.lng);
  return NextResponse.json({ ok: true, driver });
}
