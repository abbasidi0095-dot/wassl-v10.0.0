import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getTaxiRides } from "@/lib/db";
import { getTranslator } from "@/lib/i18n-server";
import { StaffHeader } from "@/components/staff-header";
import { TAXI_STATUS_TEXT } from "@/lib/taxi-status";
import { money, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Taxi operations" };

export default async function AdminTaxiPage() {
  const session = await requireRole("admin");
  const { t } = await getTranslator();
  const rides = await getTaxiRides({ limit: 100 });
  const active = rides.filter((ride) => !["completed", "cancelled"].includes(ride.status));
  const completed = rides.filter((ride) => ride.status === "completed");
  const cash = completed.reduce((sum, ride) => sum + ride.fare, 0);

  return (
    <div className="staff-shell">
      <StaffHeader
        session={session}
        title="Taxi operations"
        subtitle="Rides, drivers and cash"
        links={[
          { href: "/admin", label: "Overview" },
          { href: "/admin/accounts", label: "Accounts" },
          { href: "/admin/taxi", label: "Taxi" },
          { href: "/admin#orders", label: "Orders" },
          { href: "/admin#stores", label: "Stores" },
        ]}
        accent="ink"
      />
      <main className="container-wassl py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="eyebrow">Wassl Taxi</div>
            <h1 className="display mt-2 text-4xl">{t("Taxi rides")}</h1>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="card-flat px-4 py-2">
              <div className="text-lg font-extrabold">{active.length}</div>
              <div className="text-[11px] uppercase tracking-wider text-ink/40">Active</div>
            </div>
            <div className="card-flat px-4 py-2">
              <div className="text-lg font-extrabold">{completed.length}</div>
              <div className="text-[11px] uppercase tracking-wider text-ink/40">Completed</div>
            </div>
            <div className="card-flat px-4 py-2">
              <div className="text-lg font-extrabold">{money(cash)}</div>
              <div className="text-[11px] uppercase tracking-wider text-ink/40">Cash</div>
            </div>
          </div>
        </div>

        {rides.length ? (
          <div className="card mt-4 overflow-hidden">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Ride</th>
                    <th>{t("Customer")}</th>
                    <th>{t("Route")}</th>
                    <th>{t("Fare")}</th>
                    <th>{t("Status")}</th>
                    <th>{t("Driver")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rides.map((ride) => (
                    <tr key={ride.id}>
                      <td className="mono text-[11px] text-ink/45">
                        {ride.id.replace("ride_", "#").toUpperCase()}
                        <div className="text-[11px] text-ink/30">{timeAgo(ride.createdAt)}</div>
                      </td>
                      <td>
                        <div className="font-extrabold">{ride.customerName}</div>
                        <div className="text-[11px] text-ink/35">{ride.customerPhone}</div>
                      </td>
                      <td>
                        <div className="max-w-[220px] truncate text-[13px] font-bold">
                          {ride.pickupLabel} → {ride.dropoffLabel}
                        </div>
                        <div className="text-[11px] text-ink/35">
                          {ride.distanceKm.toFixed(1)} km · {ride.citySlug}
                        </div>
                      </td>
                      <td className="font-extrabold">{money(ride.fare)}</td>
                      <td>
                        <span className="pill">{t(TAXI_STATUS_TEXT[ride.status])}</span>
                      </td>
                      <td className="text-[13px]">
                        {ride.driverName || <span className="text-ink/30">—</span>}
                      </td>
                      <td className="text-end">
                        <Link href={`/taxi/${ride.id}`} className="btn btn-ghost btn-sm">
                          {t("View")}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="card mt-4 grid place-items-center px-6 py-12 text-center">
            <p className="text-sm font-bold text-ink/45">{t("No rides yet")}</p>
          </div>
        )}
      </main>
    </div>
  );
}
