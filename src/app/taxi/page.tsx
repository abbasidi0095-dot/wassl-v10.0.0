import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCities, getTaxiRides } from "@/lib/db";
import { getPreferredCity } from "@/lib/city-preference";
import { getTranslator } from "@/lib/i18n-server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { TaxiRequest } from "./taxi-request";

export const dynamic = "force-dynamic";
export const metadata = { title: "Wassl Taxi" };

export default async function TaxiPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=taxi");
  const { t } = await getTranslator();

  const cities = await getCities();
  const currentCity = await getPreferredCity(cities);
  const rides = await getTaxiRides({ customerId: session.userId, limit: 10 });
  const activeRide = rides.find(
    (ride) => !["completed", "cancelled"].includes(ride.status),
  );

  return (
    <>
      <SiteHeader cities={cities} currentCity={currentCity} />
      <main className="container-wassl pb-16">
        <div className="border-b border-line pb-6 pt-8 lg:pb-8 lg:pt-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[13px] text-muted">
                <span className="status-dot live-dot text-success" />
                {t("Cash to driver")}
              </div>
              <h1 className="display mt-3 text-[clamp(2.4rem,1.6rem+3vw,4rem)]">Wassl Taxi</h1>
            </div>
            <div className="text-[13px] text-muted">
              {t("Fare confirmed before you book")}
            </div>
          </div>
          <p className="mt-3 max-w-[52ch] text-[14px] leading-6 text-muted">
            {t(
              "Request a local ride, see the distance and fare, then pay the driver in cash when you arrive.",
            )}
          </p>
        </div>

        <div className="mt-6">
          <TaxiRequest
            cities={cities}
            defaultCitySlug={currentCity.slug}
            activeRide={activeRide ?? null}
            history={rides.filter((ride) => ["completed", "cancelled"].includes(ride.status)).slice(0, 4)}
          />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
