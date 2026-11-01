import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { updateBusinessAccountStatus } from "@/lib/db";
import type { BusinessAccountStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = getSessionFromRequest(request);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Operations access required" }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as
    | { status?: BusinessAccountStatus }
    | null;
  if (!body?.status || !["pending", "approved", "rejected"].includes(body.status)) {
    return NextResponse.json({ error: "Choose a valid status" }, { status: 400 });
  }
  const { id } = await params;
  try {
    const account = await updateBusinessAccountStatus(
      id,
      body.status,
      { role: "admin", id: session.userId, name: session.name },
    );
    return NextResponse.json({ ok: true, account });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update the account" },
      { status: 400 },
    );
  }
}
