import { NextResponse } from "next/server";
import { effectiveAccountStatus, ensureBootstrapAdmin, getUserByEmail } from "@/lib/db";
import { verifyPassword } from "@/lib/security";
import { createSessionToken } from "@/lib/security";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { homeForRole } from "@/lib/auth-config";
import type { Session } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { email?: string; password?: string }
    | null;

  const email = body?.email?.trim().toLowerCase() || "";
  const password = body?.password || "";
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 },
    );
  }

  // Makes the operator account available on databases created before password
  // login existed. Safe to call on every sign-in.
  await ensureBootstrapAdmin();

  const user = await getUserByEmail(email);
  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 },
    );
  }

  const status = effectiveAccountStatus(user);
  if (status === "rejected") {
    return NextResponse.json(
      { error: "This account was not approved. Contact Wassl operations." },
      { status: 403 },
    );
  }

  const session: Session = {
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    status,
    storeId: user.storeId,
    driverId: user.driverId,
  };
  const token = createSessionToken(session);

  const response = NextResponse.json({
    ok: true,
    role: user.role,
    name: user.name,
    status,
    needsApproval: status === "pending",
    redirect: status === "pending" ? "/pending" : homeForRole(user.role),
  });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(request));
  return response;
}
