import { NextResponse } from "next/server";
import {
  createAccount,
  effectiveAccountStatus,
  getCities,
  getUserByEmail,
} from "@/lib/db";
import { createSessionToken, hashPassword } from "@/lib/security";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { homeForRole } from "@/lib/auth-config";
import type { Session } from "@/lib/types";

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
  const citySlug = body.citySlug?.trim() || "";
  const storeName = body.storeName?.trim() || "";
  const vehicle = body.vehicle?.trim() || "";

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
  if ((role === "merchant" || role === "driver") && !phone) {
    return NextResponse.json(
      { error: "A phone number is required for store and driver accounts" },
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
      phone: phone || undefined,
      citySlug: city?.slug,
      requestedStoreName: storeName || undefined,
      requestedVehicle: vehicle || undefined,
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

  const status = effectiveAccountStatus(user);
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
    role: user.role,
    status,
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
