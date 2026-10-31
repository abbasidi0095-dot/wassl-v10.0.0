import { getDb, dashboardStats, getAuditLogs, getUsers } from "@/lib/db";
import { isResponse, requireApiRole } from "@/lib/api-auth";
import { getDataSourceStatus } from "@/lib/data-source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = requireApiRole(request, ["admin"]);
  if (isResponse(session)) return session;

  const db = await getDb();
  return Response.json({
    cities: db.cities,
    stores: db.stores,
    products: db.products,
    drivers: db.drivers,
    orders: db.orders,
    taxiRides: db.taxiRides ?? [],
    users: await getUsers(),
    settings: db.settings,
    auditLogs: await getAuditLogs({ limit: 150 }),
    dataSource: getDataSourceStatus(),
    stats: await dashboardStats(),
  });
}
