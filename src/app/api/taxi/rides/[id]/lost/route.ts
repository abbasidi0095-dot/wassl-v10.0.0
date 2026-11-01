import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { reportTaxiLostItem, resolveTaxiLostItem } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = getSessionFromRequest(request);
  if (!session || session.role !== "customer") {
    return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as
    | { description?: string; contact?: string }
    | null;
  if (!body?.description?.trim()) {
    return NextResponse.json({ error: "Describe the lost item" }, { status: 400 });
  }
  const { id } = await params;
  try {
    const ride = await reportTaxiLostItem(
      id,
      { role: "customer", id: session.userId, name: session.name },
      { description: body.description, contact: body.contact ?? session.email ?? "" },
    );
    return NextResponse.json({ ok: true, ride });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not report the item" },
      { status: 400 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = getSessionFromRequest(request);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Operations access required" }, { status: 403 });
  }
  const { id } = await params;
  try {
    const ride = await resolveTaxiLostItem(id, {
      role: "admin",
      id: session.userId,
      name: session.name,
    });
    return NextResponse.json({ ok: true, ride });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update the item" },
      { status: 400 },
    );
  }
}
