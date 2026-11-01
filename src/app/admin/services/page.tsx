import { requireRole } from "@/lib/auth";
import { getServiceBookings, getServiceProviders } from "@/lib/db";
import { StaffHeader } from "@/components/staff-header";
import { ServicesAdmin } from "./services-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Services operations" };

export default async function AdminServicesPage() {
  const session = await requireRole("admin");
  const [providers, bookings] = await Promise.all([
    getServiceProviders({ includePending: true }),
    getServiceBookings({ limit: 100 }),
  ]);
  return (
    <div className="staff-shell">
      <StaffHeader
        session={session}
        title="Services operations"
        subtitle="Providers, bookings and disputes"
        links={[
          { href: "/admin", label: "Overview" },
          { href: "/admin/accounts", label: "Accounts" },
          { href: "/admin/grocery", label: "Grocery" },
          { href: "/admin/taxi", label: "Taxi" },
          { href: "/admin/express", label: "Express" },
          { href: "/admin/services", label: "Services" },
          { href: "/admin/messages", label: "Messages" },
        ]}
        accent="ink"
      />
      <main className="container-wassl py-6">
        <h1 className="display text-4xl">Services operations</h1>
        <ServicesAdmin initialProviders={providers} bookings={bookings} />
      </main>
    </div>
  );
}
