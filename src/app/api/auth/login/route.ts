import { NextResponse } from "next/server";
import {
  effectiveAccountStatus,
  ensureBootstrapAdmin,
  getUserByEmail,
  issueEmailVerification,
  issuePhoneVerification,
} from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email";
import { failureMessage, isTestMode } from "@/lib/email-verification";
import { verifyPassword } from "@/lib/security";
import { isSmsConfigured, otpSmsBody, sendSms } from "@/lib/sms";
import { createPhoneTicket, maskPhone } from "@/lib/phone";
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

  /*
   * The password is correct, but the address was never confirmed. Send a fresh
   * code instead of opening a session. The code is the second factor that
   * proves the email belongs to this person.
   */
  if (user.emailVerified === false) {
    const verification = await issueEmailVerification(user.email);
    let delivered = false;
    let cooldown = 0;
    if (!verification.ok) {
      cooldown = verification.retryAfterSeconds ?? 60;
    }
    if (verification.ok) {
      const result = await sendVerificationEmail(
        verification.email,
        verification.code,
        verification.name,
      );
      delivered = result.ok;
      if (!result.ok) {
        console.error("[auth] verification email failed:", result.error);
      }
    }

    return NextResponse.json({
      ok: true,
      needsVerification: true,
      email: user.email,
      redirect: `/verify-email?email=${encodeURIComponent(user.email)}&next=login${
        delivered ? "" : `&cooldown=${cooldown}`
      }${
        !delivered && cooldown === 0 ? "&warning=1" : ""
      }`,
      ...(verification.ok && isTestMode()
        ? { devCode: verification.code }
        : {}),
    });
  }

  /*
   * A verified email is not enough for accounts created after SMS
   * verification shipped. Send a new code and keep the session closed.
   */
  if (user.phoneVerified === false) {
    const phoneIssue = await issuePhoneVerification(user.email);
    if (!phoneIssue.ok && phoneIssue.failure === "no_phone") {
      console.error("[auth] account has no valid mobile for SMS verification");
    } else {
      let sent = false;
      let warning: string | undefined;
      if (phoneIssue.ok) {
        if (isTestMode()) {
          sent = true;
        } else if (!isSmsConfigured()) {
          warning =
            "SMS verification is not configured. Contact support if this repeats.";
        } else {
          const delivery = await sendSms(
            phoneIssue.phone,
            otpSmsBody(phoneIssue.code),
          );
          sent = delivery.ok;
          if (!delivery.ok) {
            console.error("[auth] verification SMS failed:", delivery.error);
            warning =
              "We could not send the SMS. Use resend on the next screen or contact support.";
          }
        }
      } else {
        warning = failureMessage(phoneIssue.failure);
      }

      const params = new URLSearchParams({
        email: user.email,
        next: "login",
        ticket: createPhoneTicket(user.email),
      });
      if (sent) {
        params.set("sent", "1");
        params.set(
          "cooldown",
          String(phoneIssue.ok ? phoneIssue.resendAfterSeconds : 60),
        );
      } else {
        params.set(
          "cooldown",
          String(phoneIssue.ok ? 60 : phoneIssue.retryAfterSeconds ?? 30),
        );
      }
      if (warning) params.set("warning", "1");

      return NextResponse.json({
        ok: true,
        needsVerification: true,
        needsPhone: true,
        email: user.email,
        maskedPhone: phoneIssue.ok ? maskPhone(phoneIssue.phone) : undefined,
        sent,
        warning,
        redirect: `/verify-phone?${params.toString()}`,
        ...(sent && phoneIssue.ok && isTestMode()
          ? { devPhoneCode: phoneIssue.code }
          : {}),
      });
    }
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
