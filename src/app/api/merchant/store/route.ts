import { NextResponse } from "next/server";
import { updateStore } from "@/lib/db";
import { actorFromSession, isResponse, requireApiRole } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const session = requireApiRole(request, ["merchant", "admin"]);
  if (isResponse(session)) return session;
  const body = (await request.json().catch(() => null)) as
    | { isOpen?: boolean; image?: string; storeId?: string }
    | null;
  const storeId =
    session.role === "merchant" ? session.storeId : body?.storeId;
  if (!storeId) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }
  if (typeof body?.isOpen !== "boolean" && typeof body?.image !== "string") {
    return NextResponse.json(
      { error: "isOpen or image is required" },
      { status: 400 },
    );
  }
  if (
    typeof body.image === "string" &&
    body.image &&
    !/^data:image\/(png|jpeg|webp);base64,/i.test(body.image)
  ) {
    return NextResponse.json({ error: "Unsupported image format" }, { status: 400 });
  }
  const store = await updateStore(
    storeId,
    {
      ...(typeof body.isOpen === "boolean" ? { isOpen: body.isOpen } : {}),
      ...(typeof body.image === "string" ? { image: body.image || undefined } : {}),
    },
    actorFromSession(session),
  );
  return NextResponse.json({ ok: true, store });
}
