import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { inventoryIntelligence } from "@/lib/inventory";
import { computeAnalytics } from "@/lib/analytics";
import { askWasslAssistant, aiConfigured, type AiTurn } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMIT = 20;
const WINDOW = 60 * 60 * 1000;
const usage = new Map<string, number[]>();

function allowed(userId: string) {
  const now = Date.now();
  const recent = (usage.get(userId) ?? []).filter((time) => now - time < WINDOW);
  if (recent.length >= LIMIT) return false;
  recent.push(now);
  usage.set(userId, recent);
  return true;
}

export async function POST(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session || (session.role !== "merchant" && session.role !== "admin")) {
    return NextResponse.json({ error: "Merchant or operations access required" }, { status: 403 });
  }
  if (!allowed(session.userId)) {
    return NextResponse.json({ error: "Too many questions. Try again later." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as
    | { question?: string }
    | null;
  const question = body?.question?.trim().slice(0, 500);
  if (!question) return NextResponse.json({ error: "Ask a question" }, { status: 400 });

  const db = await getDb();
  let context: unknown;
  let scope: string;
  if (session.role === "merchant") {
    if (!session.storeId) {
      return NextResponse.json({ error: "Store profile required" }, { status: 403 });
    }
    const store = db.stores.find((entry) => entry.id === session.storeId);
    if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });
    const products = db.products.filter((product) => product.storeId === store.id);
    const orders = db.orders.filter((order) => order.storeId === store.id);
    const report = inventoryIntelligence({
      stores: [store],
      products,
      orders,
      reservations: (db.stockReservations ?? []).filter((entry) =>
        products.some((product) => product.id === entry.productId),
      ),
    });
    context = {
      store: { name: store.name, city: store.citySlug, isOpen: store.isOpen },
      orders: orders.slice(0, 40).map((order) => ({
        code: order.code,
        status: order.status,
        total: order.total,
        createdAt: order.createdAt,
        items: order.items.map((item) => ({ name: item.name, qty: item.qty })),
      })),
      inventory: {
        skuCount: report.skuCount,
        lowCount: report.lowCount,
        outCount: report.outCount,
        soldQty: report.soldQty,
        revenue: report.revenue,
        topSellers: report.topSellers.map((item) => ({
          name: item.product.name,
          sold: item.soldQty,
          stock: item.stock,
        })),
        restock: report.restock.map((item) => ({
          name: item.product.name,
          stock: item.stock,
          suggested: item.suggestedRestock,
        })),
        slowMovers: report.slowMovers.map((item) => ({
          name: item.product.name,
          stock: item.stock,
        })),
      },
    };
    scope = "the authenticated merchant's own store only";
  } else {
    const analytics = computeAnalytics(db.orders, db.taxiRides ?? [], db.stores, db.users, db.settings.commissions);
    context = {
      stats: analytics,
      activeOrders: db.orders.filter((order) => !["delivered", "cancelled"].includes(order.status)).length,
      activeParcels: (db.parcels ?? []).filter((parcel) => !["delivered", "cancelled"].includes(parcel.status)).length,
      cities: db.cities.filter((city) => city.launchStatus === "live").map((city) => city.name),
      recentOrders: db.orders.slice(0, 20).map((order) => ({
        code: order.code,
        status: order.status,
        city: order.citySlug,
        total: order.total,
      })),
    };
    scope = "platform operations; never expose customer personal data";
  }

  const system: AiTurn = {
    role: "system",
    content: `You are Wassl Insights, an internal read-only analyst for ${scope}. Answer only from the JSON CONTEXT. Do not invent metrics, orders, prices or causes. Be concise (max 140 words), practical and specific. Never reveal customer names, phones, addresses, handover codes, passwords or API keys. You cannot change data. If the context does not answer the question, say what data is missing. Use the same language as the question.
CONTEXT:
${JSON.stringify(context)}`,
  };
  const result = await askWasslAssistant([
    system,
    { role: "user", content: question },
  ]);
  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      configured: aiConfigured(),
      error: "The insights assistant is unavailable right now. Try again shortly.",
    });
  }
  return NextResponse.json({ ok: true, answer: result.text });
}
