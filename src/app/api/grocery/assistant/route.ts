import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { buildAssistantPlan } from "@/lib/grocery-assistant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { query?: string; citySlug?: string }
    | null;
  const query = (body?.query ?? "").trim().slice(0, 200);
  if (query.length < 2) {
    return NextResponse.json({ error: "Describe what you need" }, { status: 400 });
  }
  const citySlug = (body?.citySlug || "dakhla").slice(0, 60);
  const db = await getDb();
  const city = db.cities.find((candidate) => candidate.slug === citySlug);
  if (!city) {
    return NextResponse.json({ error: "City not found" }, { status: 404 });
  }
  const session = getSessionFromRequest(request);
  const orders =
    session?.role === "customer" && session.email
      ? db.orders.filter(
          (order) =>
            order.customerEmail?.toLowerCase() === session.email!.toLowerCase(),
        )
      : [];

  const plan = buildAssistantPlan({
    query,
    citySlug,
    stores: db.stores,
    products: db.products,
    orders,
  });
  return NextResponse.json({ ok: true, plan });
}
