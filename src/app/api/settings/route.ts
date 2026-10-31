import { NextResponse } from "next/server";
import { updateSettings } from "@/lib/db";
import { actorFromSession, isResponse, requireApiRole } from "@/lib/api-auth";
import type { PlatformSettings } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const session = requireApiRole(request, ["admin"]);
  if (isResponse(session)) return session;
  const body = (await request.json().catch(() => null)) as
    | Partial<PlatformSettings>
    | null;
  if (!body) return NextResponse.json({ error: "Invalid settings" }, { status: 400 });
  const allowed: Partial<PlatformSettings> = {};
  if (typeof body.brandName === "string") allowed.brandName = body.brandName.slice(0, 60);
  if (typeof body.brandNameAr === "string") allowed.brandNameAr = body.brandNameAr.slice(0, 60);
  if (typeof body.tagline === "string") allowed.tagline = body.tagline.slice(0, 140);
  if (typeof body.primaryColor === "string" && /^#[0-9a-f]{6}$/i.test(body.primaryColor)) {
    allowed.primaryColor = body.primaryColor.toLowerCase();
  }
  if (typeof body.accentColor === "string" && /^#[0-9a-f]{6}$/i.test(body.accentColor)) {
    allowed.accentColor = body.accentColor.toLowerCase();
  }
  if (
    typeof body.themePreset === "string" &&
    ["coastal", "aero", "midnight", "sand", "custom"].includes(body.themePreset)
  ) {
    allowed.themePreset = body.themePreset as PlatformSettings["themePreset"];
  }
  if (
    typeof body.defaultTheme === "string" &&
    ["system", "light", "dark"].includes(body.defaultTheme)
  ) {
    allowed.defaultTheme = body.defaultTheme as PlatformSettings["defaultTheme"];
  }
  if (typeof body.logoImage === "string") {
    if (!body.logoImage) allowed.logoImage = undefined;
    else if (
      /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(body.logoImage) &&
      body.logoImage.length < 600_000
    ) {
      allowed.logoImage = body.logoImage;
    }
  }
  if (typeof body.supportPhone === "string") allowed.supportPhone = body.supportPhone.slice(0, 30);
  if (typeof body.commissionRate === "number") {
    allowed.commissionRate = Math.max(0, Math.min(40, body.commissionRate));
  }
  if (typeof body.defaultDeliveryFee === "number") {
    allowed.defaultDeliveryFee = Math.max(0, Math.min(100, body.defaultDeliveryFee));
  }
  if (typeof body.cityWaitlistEnabled === "boolean") {
    allowed.cityWaitlistEnabled = body.cityWaitlistEnabled;
  }
  return NextResponse.json({ ok: true, settings: await updateSettings(allowed, actorFromSession(session)) });
}
