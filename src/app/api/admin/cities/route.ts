import { NextResponse } from "next/server";
import { updateCity } from "@/lib/db";
import { actorFromSession, isResponse, requireApiRole } from "@/lib/api-auth";
import { sanitizeCityServices } from "@/lib/city-services";
import type { CityService, CityStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const session = requireApiRole(request, ["admin"]);
  if (isResponse(session)) return session;
  const body = (await request.json().catch(() => null)) as
    | {
        cityId?: string;
        launchStatus?: CityStatus;
        active?: boolean;
        services?: Partial<Record<CityService, boolean>>;
      }
    | null;
  if (!body?.cityId) {
    return NextResponse.json({ error: "cityId is required" }, { status: 400 });
  }
  const patch: {
    launchStatus?: CityStatus;
    active?: boolean;
    services?: Partial<Record<CityService, boolean>>;
  } = {};
  if (body.launchStatus === "live" || body.launchStatus === "soon") {
    patch.launchStatus = body.launchStatus;
  }
  if (typeof body.active === "boolean") patch.active = body.active;
  if (body.services && typeof body.services === "object") {
    patch.services = sanitizeCityServices(body.services);
  }
  try {
    return NextResponse.json({ ok: true, city: await updateCity(body.cityId, patch, actorFromSession(session)) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update city" },
      { status: 400 },
    );
  }
}
