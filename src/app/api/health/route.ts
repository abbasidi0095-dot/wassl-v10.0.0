import { NextResponse } from "next/server";
import { getDatabaseBackend } from "@/lib/db-backend";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Liveness/readiness probe used by Docker and uptime checks. */
export async function GET() {
  try {
    const db = await getDb();
    return NextResponse.json({
      ok: true,
      backend: getDatabaseBackend().kind,
      stores: db.stores.length,
      cities: db.cities.length,
      orders: db.orders.length,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        backend: getDatabaseBackend().kind,
        error: error instanceof Error ? error.message : "Database unavailable",
      },
      { status: 503 },
    );
  }
}
