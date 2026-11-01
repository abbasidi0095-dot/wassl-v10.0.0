import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { applyBusinessAccount, getBusinessAccountForUser } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session || session.role !== "customer") {
    return NextResponse.json({ account: null });
  }
  return NextResponse.json({ account: (await getBusinessAccountForUser(session.userId)) ?? null });
}

export async function POST(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session || session.role !== "customer") {
    return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as
    | {
        companyName?: string;
        contactName?: string;
        phone?: string;
        email?: string;
        citySlug?: string;
        category?: string;
      }
    | null;
  if (!body?.companyName || !body.contactName || !body.phone || !body.citySlug) {
    return NextResponse.json({ error: "Complete the business details" }, { status: 400 });
  }
  try {
    const account = await applyBusinessAccount(
      {
        companyName: body.companyName,
        contactName: body.contactName,
        phone: body.phone,
        email: body.email ?? session.email ?? "",
        citySlug: body.citySlug,
        category: body.category ?? "Other",
      },
      { role: "customer", id: session.userId, name: session.name },
    );
    return NextResponse.json({ ok: true, account }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not apply" },
      { status: 400 },
    );
  }
}
