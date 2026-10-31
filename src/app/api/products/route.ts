import { NextResponse } from "next/server";
import { createProduct, getProducts, type CreateProductInput } from "@/lib/db";
import { actorFromSession, isResponse, requireApiRole } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function numberOrUndefined(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET(request: Request) {
  const session = requireApiRole(request, ["merchant", "admin"]);
  if (isResponse(session)) return session;
  const storeId = new URL(request.url).searchParams.get("storeId") || session.storeId;
  if (!storeId) {
    return NextResponse.json({ error: "Store is required" }, { status: 400 });
  }
  if (session.role === "merchant" && storeId !== session.storeId) {
    return NextResponse.json({ error: "You can only view your own menu" }, { status: 403 });
  }
  return NextResponse.json({ products: await getProducts(storeId) });
}

export async function POST(request: Request) {
  const session = requireApiRole(request, ["merchant", "admin"]);
  if (isResponse(session)) return session;

  const body = (await request.json().catch(() => null)) as
    | Partial<CreateProductInput>
    | null;
  if (!body?.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "Item name is required" }, { status: 400 });
  }
  if (!body.category || typeof body.category !== "string") {
    return NextResponse.json({ error: "Choose a category" }, { status: 400 });
  }
  const price = numberOrUndefined(body.price);
  if (price === undefined || price <= 0) {
    return NextResponse.json({ error: "Enter a price greater than zero" }, { status: 400 });
  }

  const storeId = session.role === "merchant" ? session.storeId : body.storeId;
  if (!storeId) {
    return NextResponse.json({ error: "Store is required" }, { status: 400 });
  }
  if (session.role === "merchant" && body.storeId && body.storeId !== session.storeId) {
    return NextResponse.json(
      { error: "You can only edit your own menu" },
      { status: 403 },
    );
  }

  try {
    const product = await createProduct(
      {
        storeId,
        name: body.name,
        category: body.category,
        description: body.description,
        image: body.image,
        price,
        available: body.available ?? true,
        popular: Boolean(body.popular),
        tags: Array.isArray(body.tags) ? body.tags : undefined,
        calories: numberOrUndefined(body.calories),
        sku: body.sku,
        barcode: body.barcode,
        brand: body.brand,
        unit: body.unit,
        stock: numberOrUndefined(body.stock),
        lowStockThreshold: numberOrUndefined(body.lowStockThreshold),
        aisle: body.aisle,
        variants: Array.isArray(body.variants) ? body.variants : undefined,
        substitutionAllowed:
          typeof body.substitutionAllowed === "boolean"
            ? body.substitutionAllowed
            : undefined,
        limitPerOrder: numberOrUndefined(body.limitPerOrder),
      },
      actorFromSession(session),
    );
    return NextResponse.json({ ok: true, product }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not add the item" },
      { status: 400 },
    );
  }
}
