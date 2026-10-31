import { NextResponse } from "next/server";
import {
  confirmEmailVerification,
  effectiveAccountStatus,
  getUserByEmail,
} from "@/lib/db";
import { createSessionToken } from "@/lib/security";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { homeForRole } from "@/lib/auth-config";
import { failureMessage } from "@/lib/email-verification";
import type { Session } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Checks a verification code and, on success, opens the session. No session is
 * created for unverified accounts anywhere else in the auth flow.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { email?: string; code?: string }
    | null;

  const email = body?.email?.trim().toLowerCase() || "";
  const code = body?.code?.replace(/\s/g, "") || "";

  if (!email || !/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: "Enter the 6-digit code from your email" },
      { status: 400 },
    );
  }

  const result = await confirmEmailVerification(email, code);
  if (!result.ok) {
    return NextResponse.json(
      { error: failureMessage(result.failure), code: result.failure },
      { status: 400 },
    );
  }

  const status = effectiveAccountStatus(result.user);
  if (status === "rejected") {
    return NextResponse.json(
      { error: "This account was not approved. Contact Wassl operations." },
      { status: 403 },
    );
  }

  // Refresh the account in case approval changed the role or bindings between
  // the issue and the confirmation.
  const user = (await getUserByEmail(email)) ?? result.user;

  const session: Session = {
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    status,
    storeId: user.storeId,
    driverId: user.driverId,
  };

  const response = NextResponse.json({
    ok: true,
    verified: true,
    role: user.role,
    name: user.name,
    needsApproval: status === "pending",
    redirect: status === "pending" ? "/pending" : homeForRole(user.role),
  });
  response.cookies.set(
    SESSION_COOKIE,
    createSessionToken(session),
    sessionCookieOptions(request),
  );
  return response;
}
