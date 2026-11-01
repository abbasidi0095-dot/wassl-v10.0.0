import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = (url.searchParams.get("code") || "").replace(/\s+/g, "");
  if (code.length < 4) {
    return NextResponse.json({ error: "Enter a barcode" }, { status: 400 });
  }
  const db = await getDb();
  const storeById = new Map(db.stores.map((store) => [store.id, store]));
  const product = db.products.find((item) => {
    const store = storeById.get(item.storeId);
    return (
      store?.category === "grocery" &&
      (item.barcode === code || item.sku?.toUpperCase() === code.toUpperCase())
    );
  });
  if (!product) {
    return NextResponse.json({ error: "No grocery product matches that barcode" }, { status: 404 });
  }
  const store = storeById.get(product.storeId);
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }
  return NextResponse.json({
    product: {
      ...product,
      image: product.image?.startsWith("data:") ? undefined : product.image,
    },
    store,
  });
}
