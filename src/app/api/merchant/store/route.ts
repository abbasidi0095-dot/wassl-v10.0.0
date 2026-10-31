import { NextResponse } from "next/server";
import { updateStore } from "@/lib/db";
import { actorFromSession, isResponse, requireApiRole } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const session = requireApiRole(request, ["merchant", "admin"]);
  if (isResponse(session)) return session;
  const body = (await request.json().catch(() => null)) as
    | { isOpen?: boolean; storeId?: string }
    | null;
  const storeId =
    session.role === "merchant" ? session.storeId : body?.storeId;
  if (!storeId) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }
  if (typeof body?.isOpen !== "boolean") {
    return NextResponse.json({ error: "isOpen is required" }, { status: 400 });
  }
  const store = await updateStore(storeId, { isOpen: body.isOpen }, actorFromSession(session));
  return NextResponse.json({ ok: true, store });
}
