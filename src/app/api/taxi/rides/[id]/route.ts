import { NextResponse } from "next/server";
import { requireApiRole, isResponse } from "@/lib/api-auth";
import { getTaxiRide } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = requireApiRole(request, ["customer", "driver", "admin"]);
  if (isResponse(session)) return session;

  const { id } = await params;
  const ride = await getTaxiRide(id);
  if (!ride) return NextResponse.json({ error: "Ride not found" }, { status: 404 });

  const allowed =
    session.role === "admin" ||
    ride.customerId === session.userId ||
    (session.role === "driver" && ride.driverId === session.driverId);
  if (!allowed) {
    return NextResponse.json({ error: "You cannot view this ride" }, { status: 403 });
  }

  return NextResponse.json({ ride });
}
