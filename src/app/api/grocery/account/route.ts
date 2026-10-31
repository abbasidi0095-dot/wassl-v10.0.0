import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getUserById } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Loyalty balance, favorites and lists for the signed-in customer. */
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "customer") {
    return NextResponse.json({ loyaltyPoints: 0, favorites: [], lists: [] });
  }
  const user = await getUserById(session.userId);
  return NextResponse.json({
    loyaltyPoints: user?.loyaltyPoints ?? 0,
    favorites: user?.favorites ?? [],
    lists: user?.shoppingLists ?? [],
  });
}
