import { NextResponse } from "next/server";
import { estimateParcelFare, parcelDistance } from "@/lib/express";
import type { ParcelSize } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        size?: ParcelSize;
        pickupLat?: number;
        pickupLng?: number;
        dropoffLat?: number;
        dropoffLng?: number;
      }
    | null;
  if (
    !body?.size ||
    typeof body.pickupLat !== "number" ||
    typeof body.pickupLng !== "number" ||
    typeof body.dropoffLat !== "number" ||
    typeof body.dropoffLng !== "number"
  ) {
    return NextResponse.json({ error: "Parcel locations and size are required" }, { status: 400 });
  }
  const distanceKm = parcelDistance(
    { lat: body.pickupLat, lng: body.pickupLng },
    { lat: body.dropoffLat, lng: body.dropoffLng },
  );
  return NextResponse.json({
    distanceKm,
    fare: estimateParcelFare(body.size, distanceKm),
  });
}
