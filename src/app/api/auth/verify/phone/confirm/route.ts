import { NextResponse } from "next/server";
import {
  confirmPhoneVerification,
  effectiveAccountStatus,
  getUserByEmail,
} from "@/lib/db";
import { isEmailVerified } from "@/lib/email-verification";
import { createSessionToken } from "@/lib/security";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { homeForRole } from "@/lib/auth-config";
import { failureMessage } from "@/lib/email-verification";
import { verifyPhoneTicket } from "@/lib/phone";
import type { Session } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Checks the SMS code and only then opens the account session. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { email?: string; code?: string; ticket?: string }
    | null;

  const email = body?.email?.trim().toLowerCase() || "";
  const code = body?.code?.replace(/\s/g, "") || "";
  const ticket = body?.ticket || "";

  if (!email || !/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: "Enter the 6-digit code from your SMS" },
      { status: 400 },
    );
  }
  if (!verifyPhoneTicket(email, ticket)) {
    return NextResponse.json(
      { error: "Your verification session expired. Sign in again." },
      { status: 403 },
    );
  }

  const existing = await getUserByEmail(email);
  if (!existing || !isEmailVerified(existing)) {
    return NextResponse.json(
      { error: "Verify your email before verifying your mobile." },
      { status: 400 },
    );
  }

  const result = await confirmPhoneVerification(email, code);
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
