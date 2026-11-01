import { requireRole } from "@/lib/auth";
import { getDrivers, getParcels } from "@/lib/db";
import { StaffHeader } from "@/components/staff-header";
import { ExpressAdmin } from "./express-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Express operations" };

export default async function AdminExpressPage() {
  const session = await requireRole("admin");
  const [parcels, drivers] = await Promise.all([
    getParcels({ limit: 100 }),
    getDrivers(),
  ]);

  return (
    <div className="staff-shell">
      <StaffHeader
        session={session}
        title="Express operations"
        subtitle="Parcel assignment, handover and incidents"
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
        <ExpressAdmin initialParcels={parcels} drivers={drivers} />
      </main>
    </div>
  );
}
