import { NextResponse } from "next/server";
import {
  effectiveAccountStatus,
  ensureBootstrapAdmin,
  getUserByEmail,
  issueEmailVerification,
} from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email";
import { failureMessage, isTestMode } from "@/lib/email-verification";
import { verifyPassword } from "@/lib/security";
import { createPhoneTicket, maskPhone, normalizeMoroccanPhone } from "@/lib/phone";
import { CITY_COOKIE, CITY_COOKIE_OPTIONS } from "@/lib/city-cookie";
import { availablePhoneChannels, phoneVerificationRequired } from "@/lib/otp-config";
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

  const citySlug = user.citySlug;
  function withCity(response: NextResponse) {
    if (citySlug) {
      response.cookies.set(CITY_COOKIE, citySlug, CITY_COOKIE_OPTIONS);
    }
    return response;
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

    return withCity(
      NextResponse.json({
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
      }),
    );
  }

  /*
   * A verified email is not enough when phone verification is enabled. The
   * customer chooses SMS or WhatsApp on the next screen; nothing is sent yet.
   */
  if (user.phoneVerified === false && phoneVerificationRequired()) {
    const phone = normalizeMoroccanPhone(user.phone);
    if (!phone) {
      console.error("[auth] account has no valid mobile for phone verification");
    } else {
      const params = new URLSearchParams({
        email: user.email,
        next: "login",
        ticket: createPhoneTicket(user.email),
      });
      return withCity(
        NextResponse.json({
          ok: true,
          needsVerification: true,
          needsPhone: true,
          email: user.email,
          maskedPhone: maskPhone(phone),
          channels: availablePhoneChannels(),
          redirect: `/verify-phone?${params.toString()}`,
        }),
      );
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

  const response = withCity(
    NextResponse.json({
      ok: true,
      role: user.role,
      name: user.name,
      status,
      needsApproval: status === "pending",
      redirect: status === "pending" ? "/pending" : homeForRole(user.role),
    }),
  );
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(request));
  return response;
}
