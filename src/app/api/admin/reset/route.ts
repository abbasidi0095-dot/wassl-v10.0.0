import { NextResponse } from "next/server";
import { resetDatabase } from "@/lib/db";
import { isResponse, requireApiRole } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = requireApiRole(request, ["admin"]);
  if (isResponse(session)) return session;
  await resetDatabase();
  return NextResponse.json({ ok: true });
}
