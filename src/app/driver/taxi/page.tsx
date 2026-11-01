import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getDriver, getTaxiRides, taxiRideForDriver } from "@/lib/db";
import { StaffHeader } from "@/components/staff-header";
import { TAXI_ACTIVE_STATUSES } from "@/lib/taxi";
import { DriverTaxiQueue } from "./driver-taxi-queue";

export const dynamic = "force-dynamic";
export const metadata = { title: "Taxi rides" };

export default async function DriverTaxiPage() {
  const session = await requireRole("driver");
  if (!session.driverId) redirect("/login?next=driver");
  const driver = await getDriver(session.driverId);
  if (!driver) redirect("/login?next=driver");

  const open = (
    await getTaxiRides({ citySlug: driver.citySlug, status: "requested", limit: 50 })
  ).map(taxiRideForDriver);
  const assigned = (
    await getTaxiRides({ driverId: driver.id, limit: 20 })
  )
    .filter((ride) => TAXI_ACTIVE_STATUSES.includes(ride.status))
    .map(taxiRideForDriver);

  return (
    <div className="staff-shell">
      <StaffHeader
        session={session}
        title={driver.name}
        subtitle={`${driver.citySlug} · taxi workspace`}
        links={[
          { href: "/driver", label: "My route" },
          { href: "/driver/taxi", label: "Taxi rides" },
          { href: "/driver/messages", label: "Messages" },
          { href: "/driver#cash", label: "Cash & earnings" },
        ]}
        accent="saffron"
      />
      <main className="container-wassl py-6">
        <DriverTaxiQueue driver={driver} initialOpen={open} initialAssigned={assigned} />
      </main>
    </div>
  );
}
