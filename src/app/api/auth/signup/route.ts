import { NextResponse } from "next/server";
import {
  createAccount,
  effectiveAccountStatus,
  getCities,
  getUserByEmail,
  issueEmailVerification,
} from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email";
import { isTestMode } from "@/lib/email-verification";
import { hashPassword } from "@/lib/security";
import { normalizeMoroccanPhone } from "@/lib/phone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SELF_SERVICE_ROLES = ["customer", "merchant", "driver"] as const;
type SelfServiceRole = (typeof SELF_SERVICE_ROLES)[number];

function isSelfServiceRole(value: string): value is SelfServiceRole {
  return (SELF_SERVICE_ROLES as readonly string[]).includes(value);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        name?: string;
        email?: string;
        password?: string;
        role?: string;
        phone?: string;
        citySlug?: string;
        storeName?: string;
        vehicle?: string;
        kind?: string;
        plate?: string;
      }
    | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const name = body.name?.trim() || "";
  const email = body.email?.trim().toLowerCase() || "";
  const password = body.password || "";
  const role = body.role?.trim().toLowerCase() || "customer";
  const phone = body.phone?.trim() || "";
  const normalizedPhone = normalizeMoroccanPhone(phone);
  const citySlug = body.citySlug?.trim() || "";
  const storeName = body.storeName?.trim() || "";
  const vehicle = body.vehicle?.trim() || "";
  const kind =
    body.kind === "taxi" || body.kind === "both"
      ? body.kind
      : body.kind === "delivery"
        ? "delivery"
        : undefined;
  const plate = body.plate?.trim() || "";

  if (name.length < 2) {
    return NextResponse.json({ error: "Enter your full name" }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Use a password with at least 8 characters" },
      { status: 400 },
    );
  }
  if (!isSelfServiceRole(role)) {
    return NextResponse.json(
      { error: "Admin accounts are provisioned by Wassl operations" },
      { status: 403 },
    );
  }
  if (!normalizedPhone) {
    return NextResponse.json(
      {
        error:
          "Enter a valid Moroccan mobile number (06 or 07) so we can text your verification code.",
      },
      { status: 400 },
    );
  }
  if (role === "merchant" && !storeName) {
    return NextResponse.json(
      { error: "Enter the name of your store" },
      { status: 400 },
    );
  }
  if (role === "driver" && !vehicle) {
    return NextResponse.json(
      { error: "Tell us what you drive (motorbike, car, bicycle…)" },
      { status: 400 },
    );
  }
  if (role === "driver" && kind && kind !== "delivery" && !plate) {
    return NextResponse.json(
      { error: "A plate number is required for taxi drivers" },
      { status: 400 },
    );
  }

  const cities = await getCities();
  const city = citySlug ? cities.find((candidate) => candidate.slug === citySlug) : undefined;
  if (citySlug && !city) {
    return NextResponse.json({ error: "Choose a city from the list" }, { status: 400 });
  }
  if ((role === "merchant" || role === "driver") && !city) {
    return NextResponse.json({ error: "Choose your city" }, { status: 400 });
  }

  const existing = await getUserByEmail(email);
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists. Sign in instead." },
      { status: 409 },
    );
  }

  let user;
  try {
    user = await createAccount({
      email,
      name,
      passwordHash: hashPassword(password),
      role,
      phone: normalizedPhone,
      citySlug: city?.slug,
      requestedStoreName: storeName || undefined,
      requestedVehicle: vehicle || undefined,
      requestedKind: kind,
      requestedPlate: plate || undefined,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not create the account",
      },
      { status: 409 },
    );
  }

  /*
   * The account exists but no session is opened yet. The six-digit code is the
   * proof that the address belongs to the person signing up; a failed delivery
   * is recoverable from the verification screen.
   */
  const verification = await issueEmailVerification(user.email);
  let delivered = false;
  let warning: string | undefined;

  if (verification.ok) {
    const result = await sendVerificationEmail(
      verification.email,
      verification.code,
      verification.name,
    );
    delivered = result.ok;
    if (!result.ok) {
      console.error("[auth] verification email failed:", result.error);
      warning =
        "Your account is ready, but we could not send the code. Use “Resend code” on the next screen.";
    }
  } else {
    warning =
      "Your account is ready, but a code could not be issued right now. Use “Resend code” on the next screen.";
  }

  const status = effectiveAccountStatus(user);
  return NextResponse.json(
    {
      ok: true,
      needsVerification: true,
      email: user.email,
      role: user.role,
      status,
      redirect: `/verify-email?email=${encodeURIComponent(user.email)}&next=signup${
        warning ? "&warning=1" : ""
      }`,
      ...(warning ? { warning } : {}),
      ...(delivered && verification.ok && isTestMode()
        ? { devCode: verification.code }
        : {}),
    },
    { status: 201 },
  );
}
