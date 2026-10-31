import { NextResponse } from "next/server";
import {
  createDriverAccount,
  createMerchantAccount,
} from "@/lib/db";
import { actorFromSession, isResponse, requireApiRole } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = requireApiRole(request, ["admin"]);
  if (isResponse(session)) return session;

  const body = (await request.json().catch(() => null)) as
    | {
        role?: string;
        name?: string;
        phone?: string;
        citySlug?: string;
        kind?: "delivery" | "taxi" | "both";
        vehicle?: string;
        plate?: string;
        photo?: string;
        email?: string;
        password?: string;
        cashLimit?: number;
        storeId?: string;
      }
    | null;
  if (!body?.role) {
    return NextResponse.json({ error: "Choose an account type" }, { status: 400 });
  }

  const actor = actorFromSession(session);
  try {
    if (body.role === "driver") {
      const result = await createDriverAccount(
        {
          name: body.name ?? "",
          phone: body.phone ?? "",
          citySlug: body.citySlug ?? "",
          kind: body.kind,
          vehicle: body.vehicle ?? "",
          plate: body.plate,
          photo: body.photo,
          email: body.email,
          password: body.password,
          cashLimit: body.cashLimit,
        },
        actor,
      );
      return NextResponse.json(
        {
          ok: true,
          role: "driver",
          email: result.email,
          password: result.password,
          driver: result.driver,
          user: {
            id: result.user.id,
            name: result.user.name,
            email: result.user.email,
            role: result.user.role,
            driverId: result.user.driverId,
          },
        },
        { status: 201 },
      );
    }

    if (body.role === "merchant") {
      if (!body.storeId) {
        return NextResponse.json({ error: "Choose a store" }, { status: 400 });
      }
      const result = await createMerchantAccount(
        {
          storeId: body.storeId,
          name: body.name,
          phone: body.phone,
          email: body.email,
          password: body.password,
        },
        actor,
      );
      return NextResponse.json(
        {
          ok: true,
          role: "merchant",
          email: result.email,
          password: result.password,
          store: result.store,
          user: {
            id: result.user.id,
            name: result.user.name,
            email: result.user.email,
            role: result.user.role,
            storeId: result.user.storeId,
          },
        },
        { status: 201 },
      );
    }

    return NextResponse.json(
      { error: "Choose driver or merchant" },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not create the account",
      },
      { status: 400 },
    );
  }
}
