import { NextResponse } from "next/server";
import { getDriverBoard } from "@/lib/db";
import { isResponse, requireApiRole } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = requireApiRole(request, ["driver"]);
  if (isResponse(session)) return session;
  if (!session.driverId) {
    return NextResponse.json({ error: "Driver profile missing" }, { status: 400 });
  }

  const board = await getDriverBoard(session.driverId);
  if (!board) {
    return NextResponse.json({ error: "Driver profile not found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      driver: board.driver,
      orders: board.orders,
      cityOrders: board.cityOrders,
      at: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}
