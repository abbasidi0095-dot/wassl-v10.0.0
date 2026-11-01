import { NextResponse } from "next/server";
import { issuePhoneVerification } from "@/lib/db";
import {
  availablePhoneChannels,
  isPhoneChannelEnabled,
  phoneVerificationRequired,
} from "@/lib/otp-config";
import { deliverPhoneOtp } from "@/lib/otp-delivery";
import {
  failureMessage,
  isTestMode,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
} from "@/lib/email-verification";
import { maskPhone, verifyPhoneTicket } from "@/lib/phone";
import type { PhoneOtpChannel } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Requests a new code on the channel chosen by the customer. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { email?: string; ticket?: string; channel?: string }
    | null;
  const email = body?.email?.trim().toLowerCase() || "";
  const ticket = body?.ticket || "";
  const requested = body?.channel || "";
  const channel: PhoneOtpChannel | null =
    requested === "sms" || requested === "whatsapp" ? requested : null;

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
  if (!phoneVerificationRequired()) {
    return NextResponse.json(
      { error: "Phone verification is not enabled yet." },
      { status: 409 },
    );
  }
  if (!channel || !isPhoneChannelEnabled(channel)) {
    return NextResponse.json(
      {
        error: "That verification channel is not available. Choose SMS or WhatsApp.",
        channels: availablePhoneChannels(),
      },
      { status: 400 },
    );
  }

  const result = await issuePhoneVerification(email, channel);
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
            "Add a Moroccan mobile number to your account before requesting a code.",
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
    const delivery = await deliverPhoneOtp(result.phone, result.code, channel);
    if (!delivery.ok) {
      console.error(
        `[auth] ${channel} verification delivery failed:`,
        delivery.error,
      );
      const message =
        delivery.code === "not_on_whatsapp"
          ? "This number is not registered on WhatsApp. Try SMS instead."
          : delivery.code === "not_ready"
            ? "WhatsApp is temporarily disconnected. Try SMS instead or contact support."
            : channel === "whatsapp"
              ? "We could not send the WhatsApp code. Try SMS instead or contact support."
              : "We could not send the SMS. Try WhatsApp instead or contact support.";
      return NextResponse.json(
        { error: message, code: delivery.code, channel },
        { status: 502 },
      );
    }
  }

  return NextResponse.json({
    ok: true,
    sent: true,
    channel,
    email: result.email,
    maskedPhone: maskPhone(result.phone),
    expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
    resendAfterSeconds: Math.floor(OTP_RESEND_COOLDOWN_MS / 1000),
    ...(isTestMode() ? { devCode: result.code } : {}),
  });
}
