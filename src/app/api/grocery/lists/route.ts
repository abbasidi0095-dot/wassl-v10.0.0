import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { addToShoppingList, getUserById, updateShoppingList } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "customer") {
    return NextResponse.json({ lists: [] });
  }
  const user = await getUserById(session.userId);
  return NextResponse.json({ lists: user?.shoppingLists ?? [] });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "customer") {
    return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as
    | { productId?: string; qty?: number }
    | null;
  if (!body?.productId) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 });
  }
  const list = await addToShoppingList(
    session.userId,
    body.productId,
    body.qty ?? 1,
  );
  return NextResponse.json({ ok: true, list });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "customer") {
    return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as
    | { listId?: string; productId?: string; qty?: number; checked?: boolean; remove?: boolean }
    | null;
  if (!body?.listId || !body.productId) {
    return NextResponse.json({ error: "listId and productId are required" }, { status: 400 });
  }
  try {
    const list = await updateShoppingList(session.userId, body.listId, {
      productId: body.productId,
      qty: body.qty,
      checked: body.checked,
      remove: body.remove,
    });
    return NextResponse.json({ ok: true, list });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update the list" },
      { status: 400 },
    );
  }
}
