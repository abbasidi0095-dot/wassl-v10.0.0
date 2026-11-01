import { NextResponse } from "next/server";
import {
  approveUser,
  getUsers,
  rejectUser,
  updateUserAccess,
  verifyUserPhoneByAdmin,
} from "@/lib/db";
import { isResponse, requireApiRole } from "@/lib/api-auth";
import type { Role } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLES: Role[] = ["admin", "customer", "merchant", "driver"];

export async function GET(request: Request) {
  const session = requireApiRole(request, ["admin"]);
  if (isResponse(session)) return session;
  return NextResponse.json({ users: await getUsers() });
}

export async function PATCH(request: Request) {
  const session = requireApiRole(request, ["admin"]);
  if (isResponse(session)) return session;

  const body = (await request.json().catch(() => null)) as
    | {
        userId?: string;
        action?: string;
        role?: string;
        storeId?: string | null;
        driverId?: string | null;
      }
    | null;

  if (!body?.userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const actor = { id: session.userId, name: session.name, role: session.role };

  try {
    if (body.action === "approve") {
      const user = await approveUser({
        userId: body.userId,
        ...(body.storeId ? { storeId: body.storeId } : {}),
        ...(body.driverId ? { driverId: body.driverId } : {}),
        actor,
      });
      return NextResponse.json({ ok: true, user });
    }
    if (body.action === "reject") {
      const user = await rejectUser({ userId: body.userId, actor });
      return NextResponse.json({ ok: true, user });
    }
    if (body.action === "verify-phone") {
      const user = await verifyUserPhoneByAdmin({
        userId: body.userId,
        actor,
      });
      return NextResponse.json({ ok: true, user });
    }

    const role = ROLES.find((candidate) => candidate === body.role);

    const user = await updateUserAccess({
      userId: body.userId,
      ...(role ? { role } : {}),
      ...(body.storeId !== undefined ? { storeId: body.storeId } : {}),
      ...(body.driverId !== undefined ? { driverId: body.driverId } : {}),
      actor,
    });
    return NextResponse.json({ ok: true, user });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not update the account",
      },
      { status: 400 },
    );
  }
}
