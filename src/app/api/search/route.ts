import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { searchPlatform } from "@/lib/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") || "").slice(0, 80);
  const citySlug = (url.searchParams.get("city") || "dakhla").slice(0, 60);
  const limit = Number(url.searchParams.get("limit") || "10");
  const db = await getDb();
  return NextResponse.json(
    searchPlatform(db, {
      query,
      citySlug,
      limit: Number.isFinite(limit) ? limit : 10,
    }),
    {
      headers: {
        "Cache-Control": "private, max-age=20, stale-while-revalidate=60",
      },
    },
  );
}
