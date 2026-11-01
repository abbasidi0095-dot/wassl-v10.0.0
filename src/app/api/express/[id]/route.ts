import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { getParcel, parcelForDriver } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const { id } = await params;
  const parcel = await getParcel(id);
  if (!parcel) return NextResponse.json({ error: "Parcel not found" }, { status: 404 });
  const allowed =
    session.role === "admin" ||
    parcel.customerId === session.userId ||
    (session.role === "driver" && parcel.driverId === session.driverId);
  if (!allowed) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  return NextResponse.json({
    parcel: session.role === "driver" ? parcelForDriver(parcel) : parcel,
  });
}
