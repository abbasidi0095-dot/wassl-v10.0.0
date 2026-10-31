import { NextResponse } from "next/server";
import { issueEmailVerification } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email";
import {
  failureMessage,
  isTestMode,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
} from "@/lib/email-verification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Requests a fresh verification code.
 *
 * The response does not reveal whether an address exists: unknown and already
 * verified addresses get the same generic success as a real send.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { email?: string }
    | null;
  const email = body?.email?.trim().toLowerCase() || "";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Enter a valid email address" },
      { status: 400 },
    );
  }

  const result = await issueEmailVerification(email);

  if (!result.ok) {
    if (result.failure === "not_found" || result.failure === "already_verified") {
      return NextResponse.json({
        ok: true,
        email,
        expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
        resendAfterSeconds: Math.floor(OTP_RESEND_COOLDOWN_MS / 1000),
      });
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

  const delivery = await sendVerificationEmail(
    result.email,
    result.code,
    result.name,
  );
  if (!delivery.ok) {
    console.error("[auth] verification email failed:", delivery.error);
    return NextResponse.json(
      {
        error:
          "We could not send the email right now. Try again, or contact support if it keeps failing.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    email: result.email,
    expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
    resendAfterSeconds: Math.floor(OTP_RESEND_COOLDOWN_MS / 1000),
    ...(isTestMode() ? { devCode: result.code } : {}),
  });
}
