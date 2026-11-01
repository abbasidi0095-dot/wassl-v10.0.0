import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getDriver, getParcels, parcelForDriver } from "@/lib/db";
import { StaffHeader } from "@/components/staff-header";
import { DriverParcelBoard } from "./driver-parcel-board";

export const dynamic = "force-dynamic";
export const metadata = { title: "Parcel deliveries" };

export default async function DriverExpressPage() {
  const session = await requireRole("driver");
  if (!session.driverId) redirect("/login?next=driver");
  const driver = await getDriver(session.driverId);
  if (!driver) redirect("/login?next=driver");

  const [assigned, queue] = await Promise.all([
    getParcels({ driverId: driver.id, limit: 30 }),
    getParcels({ citySlug: driver.citySlug, status: "requested", limit: 40 }),
  ]);

  return (
    <div className="staff-shell">
      <StaffHeader
        session={session}
        title="Parcel deliveries"
        subtitle={`${driver.citySlug} · Wassl Express`}
        links={[
          { href: "/driver", label: "My route" },
          { href: "/driver/taxi", label: "Taxi rides" },
          { href: "/driver/express", label: "Parcels" },
          { href: "/driver/messages", label: "Messages" },
        ]}
        accent="saffron"
      />
      <main className="container-wassl py-6">
        <DriverParcelBoard
          initialAssigned={assigned.map((parcel) => parcelForDriver(parcel))}
          initialQueue={queue.map((parcel) => ({
            id: parcel.id,
            code: parcel.code,
            pickupLabel: parcel.pickupLabel,
            dropoffLabel: parcel.dropoffLabel,
            distanceKm: parcel.distanceKm,
            fare: parcel.fare,
            size: parcel.size,
            createdAt: parcel.createdAt,
          }))}
        />
      </main>
    </div>
  );
}
