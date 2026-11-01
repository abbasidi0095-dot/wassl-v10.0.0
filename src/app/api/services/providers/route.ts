import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { createServiceProvider, getServiceProviders } from "@/lib/db";
import type { ServiceCategory } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = getSessionFromRequest(request);
  const citySlug = new URL(request.url).searchParams.get("city") || undefined;
  return NextResponse.json({
    providers: await getServiceProviders({
      citySlug,
      includePending: session?.role === "admin",
    }),
  });
}

export async function POST(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Operations access required" }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as
    | {
        name?: string;
        category?: ServiceCategory;
        citySlug?: string;
        description?: string;
        phone?: string;
        address?: string;
        priceFrom?: number;
        accessCode?: string;
      }
    | null;
  if (!body?.name || !body.category || !body.citySlug || !body.accessCode) {
    return NextResponse.json({ error: "Complete the provider details" }, { status: 400 });
  }
  try {
    const provider = await createServiceProvider(
      {
        name: body.name,
        category: body.category,
        citySlug: body.citySlug,
        description: body.description ?? "",
        phone: body.phone ?? "",
        address: body.address ?? "",
        priceFrom: Math.max(0, Math.round(body.priceFrom ?? 0)),
        active: true,
        status: "approved",
        accessCode: body.accessCode.toUpperCase(),
      },
      { role: "admin", id: session.userId, name: session.name },
    );
    return NextResponse.json({ ok: true, provider }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not add the provider" },
      { status: 400 },
    );
  }
}
