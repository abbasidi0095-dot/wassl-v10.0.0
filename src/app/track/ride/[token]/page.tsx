import { notFound } from "next/navigation";
import Link from "next/link";
import { getCities, getTaxiRideByShareToken } from "@/lib/db";
import { TAXI_STATUS_TEXT } from "@/lib/taxi-status";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MapView } from "@/components/map-view";
import { money } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shared ride" };

export default async function SharedRidePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const ride = await getTaxiRideByShareToken(token);
  if (!ride) notFound();
  const cities = await getCities();
  const city =
    cities.find((entry) => entry.slug === ride.citySlug) ??
    cities.find((entry) => entry.slug === "dakhla") ??
    cities[0];

  return (
    <>
      <SiteHeader cities={cities} currentCity={city} />
      <main className="container-wassl py-8">
        <div className="mx-auto max-w-2xl">
          <div className="eyebrow">Wassl Taxi · shared live ride</div>
          <h1 className="display mt-2 text-[clamp(2rem,1.6rem+2vw,3rem)]">
            {ride.pickupLabel} → {ride.dropoffLabel}
          </h1>
          <p className="mt-2 text-[13px] text-muted">
            {ride.customerName.split(" ")[0]} shared this ride with you.
          </p>
          <div className="aero-tile mt-5 overflow-hidden rounded-[10px] border">
            <MapView
              points={[
                {
                  id: "pickup",
                  lat: ride.pickupLat,
                  lng: ride.pickupLng,
                  kind: "pickup",
                  label: ride.pickupLabel,
                },
                {
                  id: "dropoff",
                  lat: ride.dropoffLat,
                  lng: ride.dropoffLng,
                  kind: "dropoff",
                  label: ride.dropoffLabel,
                },
                ...(ride.driverId
                  ? [
                      {
                        id: "driver",
                        lat: ride.pickupLat + 0.002,
                        lng: ride.pickupLng + 0.002,
                        kind: "driver" as const,
                        label: ride.driverName || "Driver",
                      },
                    ]
                  : []),
              ]}
              center={{ lat: ride.pickupLat, lng: ride.pickupLng }}
              zoom={13}
              height={320}
            />
            <div className="grid gap-3 border-t border-line p-4 text-[12px] sm:grid-cols-2">
              <div>
                <div className="text-[10px] text-muted">Status</div>
                <div className="font-semibold">{TAXI_STATUS_TEXT[ride.status]}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted">Fare</div>
                <div className="font-semibold tnum">{money(ride.fare)}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted">Driver</div>
                <div className="font-semibold">{ride.driverName || "Being assigned"}</div>
                {ride.vehicle ? (
                  <div className="text-[10px] text-muted">
                    {ride.vehicle} · {ride.plate}
                  </div>
                ) : null}
              </div>
              <div>
                <div className="text-[10px] text-muted">Last update</div>
                <div className="font-semibold">
                  {new Date(ride.updatedAt).toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-muted">
            This page is read-only. It never shows the customer’s phone, handover code or payment details.
          </p>
          <Link href="/" className="btn btn-ghost btn-sm mt-4">
            Wassl home
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
