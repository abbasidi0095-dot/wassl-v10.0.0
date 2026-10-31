import { NextResponse } from "next/server";
import {
  createStore,
  deleteStoreAdmin,
  updateStoreAdmin,
  type CreateStoreInput,
} from "@/lib/db";
import { actorFromSession, isResponse, requireApiRole } from "@/lib/api-auth";
import type { Store } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATEGORIES: Store["category"][] = [
  "restaurant",
  "grocery",
  "pharmacy",
  "cafe",
  "gifts",
];

function numberOrUndefined(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function POST(request: Request) {
  const session = requireApiRole(request, ["admin"]);
  if (isResponse(session)) return session;

  const body = (await request.json().catch(() => null)) as
    | (Partial<CreateStoreInput> & { category?: string })
    | null;
  if (!body?.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "Store name is required" }, { status: 400 });
  }
  if (!body.citySlug) {
    return NextResponse.json({ error: "City is required" }, { status: 400 });
  }
  if (!body.category || !CATEGORIES.includes(body.category as Store["category"])) {
    return NextResponse.json({ error: "Choose a store category" }, { status: 400 });
  }

  try {
    const store = await createStore(
      {
        name: body.name,
        nameAr: body.nameAr,
        citySlug: body.citySlug,
        category: body.category as Store["category"],
        tagline: body.tagline,
        description: body.description,
        address: body.address,
        landmark: body.landmark,
        lat: numberOrUndefined(body.lat),
        lng: numberOrUndefined(body.lng),
        prepTime: numberOrUndefined(body.prepTime),
        minOrder: numberOrUndefined(body.minOrder),
        deliveryFee: numberOrUndefined(body.deliveryFee),
        commissionRate: numberOrUndefined(body.commissionRate),
        phone: body.phone,
        ownerName: body.ownerName,
        image: typeof body.image === "string" ? body.image : undefined,
        isOpen: Boolean(body.isOpen),
        tags: Array.isArray(body.tags) ? body.tags : undefined,
      },
      actorFromSession(session),
    );
    return NextResponse.json({ ok: true, store }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create the store" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  const session = requireApiRole(request, ["admin"]);
  if (isResponse(session)) return session;

  const body = (await request.json().catch(() => null)) as
    | { storeId?: string; patch?: Record<string, unknown> }
    | null;
  if (!body?.storeId || !body.patch) {
    return NextResponse.json({ error: "storeId and patch are required" }, { status: 400 });
  }

  const allowed = new Set([
    "name",
    "nameAr",
    "citySlug",
    "category",
    "tagline",
    "description",
    "address",
    "landmark",
    "lat",
    "lng",
    "prepTime",
    "minOrder",
    "deliveryFee",
    "commissionRate",
    "phone",
    "ownerName",
    "isOpen",
    "image",
  ]);
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body.patch)) {
    if (allowed.has(key)) patch[key] = value;
  }

  try {
    const store = await updateStoreAdmin(
      body.storeId,
      patch as Parameters<typeof updateStoreAdmin>[1],
      actorFromSession(session),
    );
    return NextResponse.json({ ok: true, store });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update the store" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const session = requireApiRole(request, ["admin"]);
  if (isResponse(session)) return session;
  const body = (await request.json().catch(() => null)) as
    | { storeId?: string }
    | null;
  if (!body?.storeId) {
    return NextResponse.json({ error: "storeId is required" }, { status: 400 });
  }
  try {
    return NextResponse.json({
      ok: true,
      store: await deleteStoreAdmin(body.storeId, actorFromSession(session)),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not delete the store" },
      { status: 400 },
    );
  }
}
