import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { createParcel, getParcels } from "@/lib/db";
import type { ParcelSize } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIZES: ParcelSize[] = ["document", "small", "medium", "large"];

export async function GET(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const status = params.get("status") as
    | "requested"
    | "accepted"
    | "picked_up"
    | "in_transit"
    | "delivered"
    | "cancelled"
    | null;
  if (session.role === "customer") {
    const parcels = await getParcels({
      customerId: session.userId,
      status: status ?? undefined,
      limit: 30,
    });
    return NextResponse.json({ parcels });
  }
  if (session.role === "driver") {
    const [assigned, queue] = await Promise.all([
      getParcels({ driverId: session.driverId, limit: 30 }),
      getParcels({ status: "requested", limit: 40 }),
    ]);
    return NextResponse.json({ parcels: assigned, queue });
  }
  if (session.role === "admin") {
    return NextResponse.json({
      parcels: await getParcels({ status: status ?? undefined, limit: 100 }),
    });
  }
  return NextResponse.json({ error: "Not available for this account" }, { status: 403 });
}

export async function POST(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as
    | {
        citySlug?: string;
        customerName?: string;
        customerPhone?: string;
        pickupLabel?: string;
        pickupLat?: number;
        pickupLng?: number;
        dropoffLabel?: string;
        dropoffLat?: number;
        dropoffLng?: number;
        recipientName?: string;
        recipientPhone?: string;
        size?: ParcelSize;
        description?: string;
        notes?: string;
      }
    | null;
  if (
    !body?.citySlug ||
    !body.customerName?.trim() ||
    !body.customerPhone?.trim() ||
    !body.pickupLabel?.trim() ||
    !body.dropoffLabel?.trim() ||
    !body.recipientName?.trim() ||
    !body.recipientPhone?.trim() ||
    !body.size ||
    !SIZES.includes(body.size) ||
    typeof body.pickupLat !== "number" ||
    typeof body.pickupLng !== "number" ||
    typeof body.dropoffLat !== "number" ||
    typeof body.dropoffLng !== "number"
  ) {
    return NextResponse.json({ error: "Complete all parcel details" }, { status: 400 });
  }
  try {
    const parcel = await createParcel(
      {
        citySlug: body.citySlug,
        customerName: body.customerName,
        customerPhone: body.customerPhone,
        customerEmail: session.email,
        pickupLabel: body.pickupLabel,
        pickupLat: body.pickupLat,
        pickupLng: body.pickupLng,
        dropoffLabel: body.dropoffLabel,
        dropoffLat: body.dropoffLat,
        dropoffLng: body.dropoffLng,
        recipientName: body.recipientName,
        recipientPhone: body.recipientPhone,
        size: body.size,
        description: body.description ?? "",
        notes: body.notes,
      },
      { role: session.role, id: session.userId, name: session.name },
    );
    return NextResponse.json({ ok: true, parcel }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not book the parcel" },
      { status: 400 },
    );
  }
}
