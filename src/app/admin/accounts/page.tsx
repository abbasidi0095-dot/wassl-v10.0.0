import { requireRole } from "@/lib/auth";
import { getDb, getUsers } from "@/lib/db";
import { StaffHeader } from "@/components/staff-header";
import { AccountsManager } from "./accounts-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Accounts · Wassl" };

export default async function AccountsPage() {
  const session = await requireRole("admin");
  const db = await getDb();
  const users = await getUsers();

  return (
    <div className="staff-shell">
      <StaffHeader
        session={session}
        title="Accounts & access"
        subtitle="Approve sign-ups and attach store or driver profiles"
        links={[
          { href: "/admin", label: "Overview" },
          { href: "/admin/accounts", label: "Accounts" },
          { href: "/admin/grocery", label: "Grocery" },
          { href: "/admin/taxi", label: "Taxi" },
          { href: "/admin/messages", label: "Messages" },
        ]}
        accent="ink"
      />
      <main className="container-wassl py-6">
        <AccountsManager
          initialUsers={users}
          stores={db.stores}
          drivers={db.drivers}
        />
      </main>
    </div>
  );
}
