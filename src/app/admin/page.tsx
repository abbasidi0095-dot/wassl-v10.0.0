import { requireRole } from "@/lib/auth";
import {
  dashboardStats,
  getAuditLogs,
  getDb,
  getOrderViews,
  getUsers,
} from "@/lib/db";
import { getDataSourceStatus } from "@/lib/data-source";
import { operationalAlerts } from "@/lib/alerts";
import { StaffHeader } from "@/components/staff-header";
import { AdminConsole } from "./admin-console";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin console" };

export default async function AdminPage() {
  const session = await requireRole("admin");
  const db = await getDb();
  const orders = await getOrderViews();
  const users = await getUsers();

  return (
    <div className="staff-shell">
      <StaffHeader
        session={session}
        title="Dispatch & platform"
        subtitle="Southern Morocco operations"
        links={[
          { href: "/admin", label: "Overview" },
          { href: "/admin/accounts", label: "Accounts" },
          { href: "/admin/grocery", label: "Grocery" },
          { href: "/admin/taxi", label: "Taxi" },
          { href: "/admin/express", label: "Express" },
          { href: "/admin/services", label: "Services" },
          { href: "/admin/business", label: "Business" },
          { href: "/admin/messages", label: "Messages" },
        ]}
        accent="ink"
      />
      <main className="container-wassl py-6">
        <AdminConsole
          initialOrders={orders}
          initialTaxiRides={db.taxiRides ?? []}
          initialStores={db.stores}
          initialDrivers={db.drivers}
          initialUsers={users}
          initialCities={db.cities}
          initialSettings={db.settings}
          initialStats={await dashboardStats()}
          initialAuditLogs={await getAuditLogs({ limit: 150 })}
          initialDataSource={getDataSourceStatus()}
          initialAlerts={operationalAlerts(db)}
        />
      </main>
    </div>
  );
}
