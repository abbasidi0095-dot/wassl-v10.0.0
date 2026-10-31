import { NextResponse } from "next/server";
import { canSendOtp, generateOtp, recordOtpSend, saveOtp } from "@/lib/otp";
import { sendOtpEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { email?: string; name?: string; role?: string }
    | null;

  const email = body?.email?.trim().toLowerCase() || "";
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  const testMode = process.env.WASSL_OTP_TEST_MODE === "1";

  if (!testMode) {
    const rate = canSendOtp(email);
    if (!rate.ok) {
      return NextResponse.json(
        {
          error: `Too many codes requested. Try again in ${Math.ceil(
            (rate.retryAfterSeconds || 60) / 60,
          )} minute(s).`,
        },
        { status: 429 },
      );
    }
  }

  const code = generateOtp();
  // Admin access is never self-service. It is granted to the addresses listed
  // in WASSL_ADMIN_EMAILS and to existing admin accounts.
  const role = body?.role === "driver" ? "driver" : "merchant";

  saveOtp(email, code, { name: body?.name?.trim() || undefined, role });

  // Test hook: e2e suites cannot read real inboxes or call Resend, so the code
  // is returned in the response instead of being emailed.
  if (testMode) {
    return NextResponse.json({ ok: true, email, devCode: code });
  }

  const sent = await sendOtpEmail(email, code);
  if (!sent.ok) {
    console.error("[auth] OTP email failed:", sent.error);
    return NextResponse.json(
      { error: "Could not send the email right now. Please try again." },
      { status: 502 },
    );
  }

  recordOtpSend(email);
  return NextResponse.json({ ok: true, email });
}
