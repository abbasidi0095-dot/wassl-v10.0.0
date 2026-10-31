import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCities, getTaxiRides } from "@/lib/db";
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
  const rides = await getTaxiRides({ customerId: session.userId, limit: 10 });
  const activeRide = rides.find(
    (ride) => !["completed", "cancelled"].includes(ride.status),
  );

  return (
    <>
      <SiteHeader cities={cities} />
      <main className="container-wassl py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="eyebrow">{t("Taxi")}</div>
            <h1 className="display mt-2 text-4xl sm:text-5xl">Wassl Taxi</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-ink/50">
              {t(
                "Request a local ride and pay the driver in cash. Your fare is confirmed before you book.",
              )}
            </p>
          </div>
          <span className="pill pill-warm">{t("Cash to driver")}</span>
        </div>

        <div className="mt-6">
          <TaxiRequest
            cities={cities}
            defaultCitySlug={cities.find((city) => city.slug === "dakhla")?.slug || cities[0]?.slug || "dakhla"}
            activeRide={activeRide ?? null}
            history={rides.filter((ride) => ["completed", "cancelled"].includes(ride.status)).slice(0, 4)}
          />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
