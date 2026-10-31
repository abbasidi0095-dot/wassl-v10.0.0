import { NextResponse } from "next/server";
import { deleteAddress, getAddresses, saveAddress } from "@/lib/db";
import type { CustomerAddress } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function publicAddress(entry: CustomerAddress) {
  return {
    id: entry.id,
    label: entry.label,
    name: entry.name,
    phone: entry.phone,
    address: entry.address,
    landmark: entry.landmark,
    lat: entry.lat,
    lng: entry.lng,
    lastUsedAt: entry.lastUsedAt,
  };
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  return NextResponse.json({
    addresses: (await getAddresses(token)).map(publicAddress),
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        token?: string;
        label?: string;
        name?: string;
        phone?: string;
        address?: string;
        landmark?: string;
        lat?: number;
        lng?: number;
      }
    | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const entry = await saveAddress({
      token: String(body.token || ""),
      label: body.label ? String(body.label) : undefined,
      name: String(body.name || ""),
      phone: String(body.phone || ""),
      address: String(body.address || ""),
      landmark: String(body.landmark || ""),
      lat: Number(body.lat),
      lng: Number(body.lng),
    });
    return NextResponse.json({ ok: true, address: publicAddress(entry) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save address" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  const id = url.searchParams.get("id") || "";
  if (!token || !id) {
    return NextResponse.json({ error: "token and id are required" }, { status: 400 });
  }
  return NextResponse.json({ ok: await deleteAddress(token, id) });
}
