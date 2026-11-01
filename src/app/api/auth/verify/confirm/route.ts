import { NextResponse } from "next/server";
import {
  confirmEmailVerification,
  effectiveAccountStatus,
  getUserByEmail,
  issuePhoneVerification,
} from "@/lib/db";
import { createSessionToken } from "@/lib/security";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { homeForRole } from "@/lib/auth-config";
import { failureMessage, isTestMode } from "@/lib/email-verification";
import { isSmsConfigured, otpSmsBody, sendSms } from "@/lib/sms";
import { createPhoneTicket, maskPhone } from "@/lib/phone";
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

  /*
   * Email is confirmed, but a new account is not admitted until the mobile is
   * verified too. Send the SMS immediately so the next screen only asks for
   * the code.
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
        verified: "email",
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
