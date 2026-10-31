import { NextResponse } from "next/server";
import { actorFromSession, isResponse, requireApiRole } from "@/lib/api-auth";
import { updateGrocerySettings } from "@/lib/db";
import type { GrocerySettings } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const session = requireApiRole(request, ["merchant", "admin"]);
  if (isResponse(session)) return session;

  const body = (await request.json().catch(() => null)) as
    | { storeId?: string; settings?: Partial<GrocerySettings> }
    | null;
  const storeId = session.role === "merchant" ? session.storeId : body?.storeId;
  if (!storeId || !body?.settings) {
    return NextResponse.json({ error: "storeId and settings are required" }, { status: 400 });
  }
  try {
    const store = await updateGrocerySettings(
      storeId,
      body.settings,
      actorFromSession(session),
    );
    return NextResponse.json({ ok: true, store });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update grocery settings" },
      { status: 400 },
    );
  }
}
