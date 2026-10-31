import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getDriverBoard } from "@/lib/db";
import { StaffHeader } from "@/components/staff-header";
import { DriverDashboard } from "./driver-dashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Driver app" };

export default async function DriverPage() {
  const session = await requireRole("driver");
  if (!session.driverId) redirect("/login?next=driver");
  const board = await getDriverBoard(session.driverId);
  if (!board) redirect("/login?next=driver");

  return (
    <div className="staff-shell">
      <StaffHeader
        session={session}
        title={board.driver.name}
        subtitle={`${board.driver.citySlug} · driver workspace`}
        links={[
          { href: "/driver", label: "My route" },
          { href: "/driver/taxi", label: "Taxi rides" },
          { href: "/driver#cash", label: "Cash & earnings" },
        ]}
        accent="saffron"
      />
      <main className="container-wassl py-6">
        <DriverDashboard
          driver={board.driver}
          initialOrders={board.orders}
          initialCityOrders={board.cityOrders}
        />
      </main>
    </div>
  );
}
