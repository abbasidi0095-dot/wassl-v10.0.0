import { NextResponse } from "next/server";
import { getDrivers, getStore } from "@/lib/db";
import { groceryAvailability, grocerySettings } from "@/lib/grocery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug") || "";
  const store = await getStore(slug);
  if (!store || store.category !== "grocery") {
    return NextResponse.json({ error: "Grocery store not found" }, { status: 404 });
  }
  const drivers = await getDrivers(store.citySlug);
  const activeDrivers = drivers.filter((driver) => driver.active).length;
  return NextResponse.json({
    store,
    settings: grocerySettings(store),
    availability: groceryAvailability(store, activeDrivers),
  });
}
