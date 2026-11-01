import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCities, getCity, getParcels, getUserById } from "@/lib/db";
import { getPreferredCity } from "@/lib/city-preference";
import { cityServiceEnabled } from "@/lib/city-services";
import { getTranslator } from "@/lib/i18n-server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ExpressBooking } from "./express-booking";

export const dynamic = "force-dynamic";
export const metadata = { title: "Wassl Express" };

export default async function ExpressPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=express");
  const { t } = await getTranslator();
  const cities = await getCities();
  const currentCity = await getPreferredCity(cities);
  if (!cityServiceEnabled(currentCity, "express")) {
    return (
      <>
        <SiteHeader cities={cities} currentCity={currentCity} />
        <main className="container-wassl py-16 text-center">
          <h1 className="display text-4xl">{t("Express is not active in this city yet.")}</h1>
          <p className="mx-auto mt-3 max-w-md text-[13px] text-muted">
            {t("We are onboarding parcel drivers. Try another city or check back soon.")}
          </p>
          <Link href="/cities" className="btn btn-primary mt-5">
            {t("Browse cities")}
          </Link>
        </main>
        <SiteFooter />
      </>
    );
  }
  const user = await getUserById(session.userId);
  const parcels = await getParcels({ customerId: session.userId, limit: 30 });

  return (
    <>
      <SiteHeader cities={cities} currentCity={currentCity} />
      <main>
        <section className="container-wassl border-b border-line pb-6 pt-8 lg:pb-8 lg:pt-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[13px] text-muted">
                <span className="status-dot live-dot text-success" />
                {t("Cash to the driver on delivery")}
              </div>
              <h1 className="display mt-3 text-[clamp(2.4rem,1.6rem+3vw,4rem)]">
                Wassl Express
              </h1>
              <p className="mt-3 max-w-[54ch] text-[14px] leading-6 text-muted">
                {t(
                  "Send documents and packages across the city. Live tracking, pickup and delivery codes, cash payment.",
                )}
              </p>
            </div>
            <div className="text-[12px] text-muted">
              {t("Documents · small · medium · large")}
            </div>
          </div>
        </section>
        <section className="container-wassl mt-6 pb-16">
          <ExpressBooking
            cities={cities}
            defaultCity={currentCity.slug}
            initialParcels={parcels}
            initialName={user?.name || session.name}
            initialPhone={user?.phone || ""}
          />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
