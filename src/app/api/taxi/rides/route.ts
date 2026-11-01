import { NextResponse } from "next/server";
import { actorFromSession, isResponse, requireApiRole } from "@/lib/api-auth";
import { createTaxiRide, getTaxiRides, taxiRideForDriver } from "@/lib/db";
import type { TaxiStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = requireApiRole(request, ["customer", "driver", "admin"]);
  if (isResponse(session)) return session;

  const status = new URL(request.url).searchParams.get("status") as TaxiStatus | null;
  const rides = await getTaxiRides({
    customerId: session.role === "customer" ? session.userId : undefined,
    driverId: session.role === "driver" ? session.driverId : undefined,
    status: status ?? undefined,
    limit: session.role === "admin" ? 100 : 20,
  });
  return NextResponse.json({
    rides: session.role === "driver" ? rides.map(taxiRideForDriver) : rides,
  });
}

export async function POST(request: Request) {
  const session = requireApiRole(request, ["customer", "admin"]);
  if (isResponse(session)) return session;

  const body = (await request.json().catch(() => null)) as
    | {
        citySlug?: string;
        pickupLabel?: string;
        dropoffLabel?: string;
        pickupLat?: number;
        pickupLng?: number;
        dropoffLat?: number;
        dropoffLng?: number;
      }
    | null;

  if (!body?.citySlug) {
    return NextResponse.json({ error: "City is required" }, { status: 400 });
  }
  const coords = [
    body.pickupLat,
    body.pickupLng,
    body.dropoffLat,
    body.dropoffLng,
  ];
  if (coords.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
    return NextResponse.json({ error: "Pickup and drop-off are required" }, { status: 400 });
  }

  try {
    const ride = await createTaxiRide(
      {
        citySlug: body.citySlug,
        pickupLabel: body.pickupLabel || "Pickup point",
        dropoffLabel: body.dropoffLabel || "Destination",
        pickupLat: body.pickupLat as number,
        pickupLng: body.pickupLng as number,
        dropoffLat: body.dropoffLat as number,
        dropoffLng: body.dropoffLng as number,
      },
      actorFromSession(session),
    );
    return NextResponse.json({ ok: true, ride }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not request the ride" },
      { status: 400 },
    );
  }
}
