import { NextResponse } from "next/server";
import {
  createOrder,
  getOrderView,
  getOrderViews,
  getStore,
  type OrderView,
} from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { notifyOrderPush } from "@/lib/push";
import { storePhoto } from "@/lib/store-images";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Compact shape used by the customer order history on the storefront. */
function orderSummary(order: OrderView) {
  return {
    id: order.id,
    code: order.code,
    status: order.status,
    storeId: order.storeId,
    storeName: order.store?.name || "Store",
    storeSlug: order.store?.slug || "",
    storeImage: order.store ? storePhoto(order.store) : null,
    storeLat: order.store?.lat ?? 0,
    storeLng: order.store?.lng ?? 0,
    deliveryFee: order.store?.deliveryFee ?? 0,
    minOrder: order.store?.minOrder ?? 0,
    citySlug: order.citySlug,
    total: order.total,
    itemCount: order.items.reduce((sum, item) => sum + item.qty, 0),
    items: order.items.map((item) => ({
      productId: item.productId,
      name: item.name,
      emoji: item.emoji,
      price: item.price,
      qty: item.qty,
      options: item.options ?? [],
    })),
    createdAt: order.createdAt,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ids = (url.searchParams.get("ids") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 40);
  const session = getSessionFromRequest(request);

  if (ids.length > 0) {
    // A signed-in customer only sees their own orders, even if they pass
    // another order id. Guests can still track the orders created on this
    // device, which is the storefront's existing by-code flow.
    const orders = await getOrderViews({
      ids,
      ...(session?.role === "customer" && session.email
        ? { customerEmail: session.email }
        : {}),
    });
    return NextResponse.json({ orders: orders.map(orderSummary) });
  }

  if (!session) {
    return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  }
  if (session.status === "pending" || session.status === "rejected") {
    return NextResponse.json(
      { error: "Your account is not active yet" },
      { status: 403 },
    );
  }
  if (session.role === "customer") {
    if (!session.email) {
      return NextResponse.json({ orders: [] });
    }
    const orders = await getOrderViews({ customerEmail: session.email });
    return NextResponse.json({ orders: orders.map(orderSummary) });
  }
  const citySlug = url.searchParams.get("citySlug") || undefined;
  let storeId = url.searchParams.get("storeId") || undefined;
  let driverId = url.searchParams.get("driverId") || undefined;
  if (session.role === "merchant") {
    storeId = session.storeId;
  }
  if (session.role === "driver") {
    driverId = session.driverId;
  }
  return NextResponse.json({
    orders: await getOrderViews({ storeId, citySlug, driverId }),
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        citySlug?: string;
        storeId?: string;
        customerName?: string;
        customerPhone?: string;
        customerEmail?: string;
        address?: string;
        landmark?: string;
        notes?: string;
        lat?: number;
        lng?: number;
        scheduledFor?: string;
        promoCode?: string;
        items?: { productId?: string; qty?: number; optionIds?: string[] }[];
      }
    | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (
    !body.citySlug ||
    !body.storeId ||
    !body.customerName?.trim() ||
    !body.customerPhone?.trim() ||
    !body.address?.trim() ||
    !body.landmark?.trim() ||
    typeof body.lat !== "number" ||
    typeof body.lng !== "number"
  ) {
    return NextResponse.json(
      { error: "Please complete your name, phone, address and map pin" },
      { status: 400 },
    );
  }

  const store = await getStore(body.storeId);
  if (!store || store.citySlug !== body.citySlug) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const session = getSessionFromRequest(request);
  const accountEmail =
    session?.role === "customer" && session.status !== "pending"
      ? session.email?.trim().toLowerCase()
      : undefined;

  const customerEmail = accountEmail || body.customerEmail?.trim().toLowerCase();
  if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  const items = (body.items || [])
    .map((item) => ({
      productId: String(item.productId || ""),
      qty: Number(item.qty || 0),
      optionIds: Array.isArray(item.optionIds)
        ? item.optionIds.map((id) => String(id)).filter(Boolean)
        : [],
    }))
    .filter((item) => item.productId && item.qty > 0);

  if (!items.length) {
    return NextResponse.json({ error: "Your cart is empty" }, { status: 400 });
  }

  try {
    const order = await createOrder({
      citySlug: body.citySlug,
      storeId: body.storeId,
      customerName: body.customerName.trim(),
      customerPhone: body.customerPhone.trim(),
      customerEmail,
      address: body.address.trim(),
      landmark: body.landmark.trim(),
      notes: body.notes?.trim(),
      lat: body.lat,
      lng: body.lng,
      scheduledFor: body.scheduledFor,
      promoCode: body.promoCode?.trim() || undefined,
      items,
    });
    void notifyOrderPush(order);
    return NextResponse.json(
      { ok: true, order: await getOrderView(order.id) },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not place order" },
      { status: 400 },
    );
  }
}
