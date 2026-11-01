import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { createServiceBooking, getServiceBookings } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const providerId = params.get("provider") || undefined;
  const bookings = await getServiceBookings({
    customerId: session.role === "customer" ? session.userId : undefined,
    providerId: session.role === "admin" ? providerId : undefined,
    limit: 100,
  });
  return NextResponse.json({ bookings });
}

export async function POST(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session || session.role !== "customer") {
    return NextResponse.json({ error: "Please sign in as a customer" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as
    | {
        providerId?: string;
        service?: string;
        description?: string;
        address?: string;
        landmark?: string;
        date?: string;
        slot?: string;
      }
    | null;
  if (!body?.providerId || !body.service || !body.description || !body.address || !body.date) {
    return NextResponse.json({ error: "Complete the booking details" }, { status: 400 });
  }
  try {
    const booking = await createServiceBooking(
      {
        providerId: body.providerId,
        service: body.service,
        description: body.description,
        address: body.address,
        landmark: body.landmark ?? "",
        date: body.date,
        slot: body.slot ?? "09:00",
      },
      { role: "customer", id: session.userId, name: session.name },
    );
    return NextResponse.json({ ok: true, booking }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not request the booking" },
      { status: 400 },
    );
  }
}
