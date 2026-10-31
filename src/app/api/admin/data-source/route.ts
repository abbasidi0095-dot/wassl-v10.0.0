import { NextResponse } from "next/server";
import { isResponse, requireApiRole } from "@/lib/api-auth";
import { getDataSourceStatus, verifySnapshotIntegrity } from "@/lib/data-source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = requireApiRole(request, ["admin"]);
  if (isResponse(session)) return session;
  return NextResponse.json({ ok: true, dataSource: getDataSourceStatus() });
}

export async function POST(request: Request) {
  const session = requireApiRole(request, ["admin"]);
  if (isResponse(session)) return session;

  const body = (await request.json().catch(() => null)) as
    | { action?: "verify" | "refresh" }
    | null;

  if (body?.action === "verify") {
    const integrity = verifySnapshotIntegrity();
    return NextResponse.json({ ok: integrity.ok, integrity });
  }

  if (body?.action === "refresh") {
    const status = getDataSourceStatus();
    if (status.locked) {
      return NextResponse.json(
        {
          error:
            "This deployment uses a locked snapshot. Re-run scripts/import-restaurants.mjs and redeploy to publish new data.",
          code: "snapshot_locked",
          dataSource: status,
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Live refresh is not implemented for this deployment", code: "not_implemented" },
      { status: 501 },
    );
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
