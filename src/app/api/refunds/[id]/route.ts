import { NextResponse } from "next/server";
import { actorFromSession, isResponse, requireApiRole } from "@/lib/api-auth";
import { updateRefundRequest } from "@/lib/db";
import type { RefundRequest } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: RefundRequest["status"][] = ["approved", "rejected", "refunded"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = requireApiRole(request, ["admin"]);
  if (isResponse(session)) return session;
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as
    | { status?: string; note?: string; restock?: boolean }
    | null;
  if (!body?.status || !STATUSES.includes(body.status as RefundRequest["status"])) {
    return NextResponse.json({ error: "A valid refund status is required" }, { status: 400 });
  }
  try {
    const refund = await updateRefundRequest(
      id,
      body.status as RefundRequest["status"],
      actorFromSession(session),
      { note: body.note, restock: body.restock },
    );
    return NextResponse.json({ ok: true, refund });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update the refund" },
      { status: 400 },
    );
  }
}
