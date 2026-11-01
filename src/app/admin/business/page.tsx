import { requireRole } from "@/lib/auth";
import { getBusinessAccounts, getBusinessOrders } from "@/lib/db";
import { StaffHeader } from "@/components/staff-header";
import { BusinessAdmin } from "./business-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Business operations" };

export default async function AdminBusinessPage() {
  const session = await requireRole("admin");
  const [accounts, orders] = await Promise.all([
    getBusinessAccounts(),
    getBusinessOrders({ limit: 100 }),
  ]);
  return (
    <div className="staff-shell">
      <StaffHeader
        session={session}
        title="Business operations"
        subtitle="Wholesale accounts and orders"
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
        <h1 className="display text-4xl">Business operations</h1>
        <BusinessAdmin initialAccounts={accounts} initialOrders={orders} />
      </main>
    </div>
  );
}
