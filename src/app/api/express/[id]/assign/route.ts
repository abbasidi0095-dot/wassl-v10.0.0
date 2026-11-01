import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { assignParcelDriver } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = getSessionFromRequest(request);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Operations access required" }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as
    | { driverId?: string }
    | null;
  if (!body?.driverId) {
    return NextResponse.json({ error: "driverId is required" }, { status: 400 });
  }
  const { id } = await params;
  try {
    const parcel = await assignParcelDriver(
      id,
      body.driverId,
      { role: "admin", id: session.userId, name: session.name },
    );
    return NextResponse.json({ ok: true, parcel });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not assign the parcel" },
      { status: 400 },
    );
  }
}
