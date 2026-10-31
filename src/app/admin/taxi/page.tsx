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
          { href: "/admin/grocery", label: "Grocery" },
          { href: "/admin/taxi", label: "Taxi" },
        ]}
        accent="ink"
      />
      <main className="container-wassl py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="eyebrow">Wassl Taxi</div>
            <h1 className="display mt-2 text-4xl">{t("Taxi rides")}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/admin#drivers" className="btn btn-ghost btn-sm">
              Driver fleet
            </Link>
            <div className="grid grid-cols-3 gap-2 text-center">
            <div className="card-flat px-4 py-2">
              <div className="text-lg font-semibold">{active.length}</div>
              <div className="text-[11px] uppercase tracking-wider text-muted">Active</div>
            </div>
            <div className="card-flat px-4 py-2">
              <div className="text-lg font-semibold">{completed.length}</div>
              <div className="text-[11px] uppercase tracking-wider text-muted">Completed</div>
            </div>
            <div className="card-flat px-4 py-2">
              <div className="text-lg font-semibold">{money(cash)}</div>
              <div className="text-[11px] uppercase tracking-wider text-muted">Cash</div>
            </div>
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
                    <th>Handover</th>
                    <th>{t("Driver")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rides.map((ride) => (
                    <tr key={ride.id}>
                      <td className="mono text-[11px] text-muted">
                        {ride.id.replace("ride_", "#").toUpperCase()}
                        <div className="text-[11px] text-muted">{timeAgo(ride.createdAt)}</div>
                      </td>
                      <td>
                        <div className="font-semibold">{ride.customerName}</div>
                        <div className="text-[11px] text-muted">{ride.customerPhone}</div>
                      </td>
                      <td>
                        <div className="max-w-[220px] truncate text-[13px] font-bold">
                          {ride.pickupLabel} → {ride.dropoffLabel}
                        </div>
                        <div className="text-[11px] text-muted">
                          {ride.distanceKm.toFixed(1)} km · {ride.citySlug}
                        </div>
                      </td>
                      <td className="font-semibold">{money(ride.fare)}</td>
                      <td>
                        <span className="pill">{t(TAXI_STATUS_TEXT[ride.status])}</span>
                      </td>
                      <td>
                        {ride.verificationCode ? (
                          <span className="font-display text-[18px] font-semibold tracking-[0.12em] tnum">
                            {ride.verificationCode}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="text-[13px]">
                        {ride.driverName ? (
                          <span className="inline-flex items-center gap-2">
                            {ride.driverPhoto ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={ride.driverPhoto}
                                alt=""
                                className="h-7 w-7 rounded-full object-cover"
                              />
                            ) : null}
                            <span>
                              <span className="block font-semibold">{ride.driverName}</span>
                              <span className="block text-[11px] text-muted">
                                {ride.vehicle} · {ride.plate}
                              </span>
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
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
            <p className="text-sm font-bold text-muted">{t("No rides yet")}</p>
          </div>
        )}
      </main>
    </div>
  );
}
