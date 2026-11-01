import { NextResponse } from "next/server";
import { issuePhoneVerification } from "@/lib/db";
import { isSmsConfigured, otpSmsBody, sendSms } from "@/lib/sms";
import {
  failureMessage,
  isTestMode,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
} from "@/lib/email-verification";
import { maskPhone, verifyPhoneTicket } from "@/lib/phone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Requests a new SMS code for a verified email address. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { email?: string; ticket?: string }
    | null;
  const email = body?.email?.trim().toLowerCase() || "";
  const ticket = body?.ticket || "";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Enter a valid email address" },
      { status: 400 },
    );
  }
  if (!verifyPhoneTicket(email, ticket)) {
    return NextResponse.json(
      { error: "Your verification session expired. Sign in again." },
      { status: 403 },
    );
  }

  const result = await issuePhoneVerification(email);
  if (!result.ok) {
    if (
      result.failure === "not_found" ||
      result.failure === "already_verified"
    ) {
      return NextResponse.json({
        ok: true,
        sent: false,
        expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
        resendAfterSeconds: Math.floor(OTP_RESEND_COOLDOWN_MS / 1000),
      });
    }
    if (result.failure === "no_phone") {
      return NextResponse.json(
        {
          error:
            "Add a Moroccan mobile number to your account before requesting an SMS code.",
        },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error: failureMessage(result.failure),
        retryAfterSeconds: result.retryAfterSeconds,
      },
      {
        status: 429,
        headers: result.retryAfterSeconds
          ? { "Retry-After": String(result.retryAfterSeconds) }
          : undefined,
      },
    );
  }

  if (!isTestMode()) {
    if (!isSmsConfigured()) {
      console.error("[auth] SMS verification is not configured");
      return NextResponse.json(
        {
          error:
            "SMS verification is not available right now. Contact Wassl support.",
        },
        { status: 503 },
      );
    }
    const delivery = await sendSms(result.phone, otpSmsBody(result.code));
    if (!delivery.ok) {
      console.error("[auth] verification SMS failed:", delivery.error);
      return NextResponse.json(
        {
          error:
            "We could not send the SMS right now. Check the number or contact support if it keeps failing.",
        },
        { status: 502 },
      );
    }
  }

  return NextResponse.json({
    ok: true,
    sent: true,
    email: result.email,
    maskedPhone: maskPhone(result.phone),
    expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
    resendAfterSeconds: Math.floor(OTP_RESEND_COOLDOWN_MS / 1000),
    ...(isTestMode() ? { devCode: result.code } : {}),
  });
}
