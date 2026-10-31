import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { registerDevice } from "@/lib/db";
import type { DeviceToken } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLATFORMS: DeviceToken["platform"][] = ["ios", "android", "web"];

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { token?: string; platform?: string }
    | null;

  if (!body?.token || typeof body.token !== "string") {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }
  const platform = PLATFORMS.includes(body.platform as DeviceToken["platform"])
    ? (body.platform as DeviceToken["platform"])
    : "web";

  try {
    const session = await getSession();
    const device = await registerDevice({
      token: body.token,
      platform,
      userId: session?.userId,
    });
    return NextResponse.json(
      { ok: true, device: { id: device.id, platform: device.platform } },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not register the device" },
      { status: 400 },
    );
  }
}
