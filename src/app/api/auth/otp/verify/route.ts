import { NextResponse } from "next/server";
import { verifyOtp } from "@/lib/otp";
import {
  effectiveAccountStatus,
  getUserByEmail,
  upsertOtpUser,
} from "@/lib/db";
import { upsertSupabaseProfile } from "@/lib/supabase";
import { createSessionToken } from "@/lib/security";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { BOOTSTRAP_ADMIN_EMAIL } from "@/lib/auth-config";
import type { Role } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Addresses that may claim the admin role on first sign-in. */
function adminAllowlist(): string[] {
  const configured = (process.env.WASSL_ADMIN_EMAILS || BOOTSTRAP_ADMIN_EMAIL)
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (!configured.includes(BOOTSTRAP_ADMIN_EMAIL.toLowerCase())) {
    configured.push(BOOTSTRAP_ADMIN_EMAIL.toLowerCase());
  }
  return configured;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { email?: string; code?: string }
    | null;

  const email = body?.email?.trim().toLowerCase() || "";
  const code = body?.code?.trim() || "";
  if (!email || !/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: "Enter the 6-digit code from your email" },
      { status: 400 },
    );
  }

  const result = verifyOtp(email, code);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }

  const existing = await getUserByEmail(email);

  let role: Role;
  if (existing) {
    // Existing staff always keep their provisioned role and bindings.
    role = existing.role;
  } else if (adminAllowlist().includes(email)) {
    role = "admin";
  } else {
    role = result.meta?.role === "driver" ? "driver" : "merchant";
  }

  // An admin role is only ever granted to explicitly allowlisted addresses,
  // even when an older admin account still exists in the database.
  if (role === "admin" && !adminAllowlist().includes(email)) {
    return NextResponse.json(
      { error: "Admin access is provisioned by Wassl operations" },
      { status: 403 },
    );
  }

  const user = await upsertOtpUser({
    email,
    name: result.meta?.name,
    role,
  });

  const status = effectiveAccountStatus(user);
  if (status === "rejected") {
    return NextResponse.json(
      { error: "This account was not approved. Contact Wassl operations." },
      { status: 403 },
    );
  }

  // Mirror the profile into Supabase when a service-role key is configured.
  await upsertSupabaseProfile({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  const token = createSessionToken({
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    status,
    storeId: user.storeId,
    driverId: user.driverId,
  });

  // New accounts have no store/driver attached yet, so operations has to
  // approve them before a workspace is available.
  const needsApproval = status === "pending";

  const response = NextResponse.json({
    ok: true,
    role: user.role,
    name: user.name,
    isNew: !existing,
    needsApproval,
    redirect: needsApproval ? "/pending" : `/${user.role}`,
  });
  response.cookies.set(
    SESSION_COOKIE,
    token,
    sessionCookieOptions(request),
  );
  return response;
}
