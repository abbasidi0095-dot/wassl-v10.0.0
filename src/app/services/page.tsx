import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getCities, getCity, getServiceBookings, getServiceProviders } from "@/lib/db";
import { cityServiceEnabled } from "@/lib/city-services";
import { getTranslator } from "@/lib/i18n-server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ServicesMarket } from "./services-market";

export const dynamic = "force-dynamic";
export const metadata = { title: "Local services" };

export default async function ServicesPage() {
  const session = await requireRole("customer");
  const { t } = await getTranslator();
  const cities = await getCities();
  const dakhla = (await getCity("dakhla")) ?? cities[0];
  if (!cityServiceEnabled(dakhla, "services")) {
    return (
      <>
        <SiteHeader cities={cities} currentCity={dakhla} />
        <main className="container-wassl py-16 text-center">
          <h1 className="display text-4xl">{t("Local services are not active here yet.")}</h1>
          <p className="mx-auto mt-3 max-w-md text-[13px] text-muted">
            {t("We are onboarding local providers. Try another city or check back soon.")}
          </p>
          <Link href="/cities" className="btn btn-primary mt-5">
            {t("Browse cities")}
          </Link>
        </main>
        <SiteFooter />
      </>
    );
  }
  const [providers, bookings] = await Promise.all([
    getServiceProviders({ citySlug: dakhla.slug }),
    getServiceBookings({ customerId: session.userId, limit: 50 }),
  ]);

  return (
    <>
      <SiteHeader cities={cities} currentCity={dakhla} />
      <main>
        <section className="container-wassl border-b border-line pb-6 pt-8 lg:pb-8 lg:pt-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[13px] text-muted">
                <span className="status-dot live-dot text-success" />
                {t("Vetted local providers")}
              </div>
              <h1 className="display mt-3 text-[clamp(2.4rem,1.6rem+3vw,4rem)]">
                Wassl Services
              </h1>
              <p className="mt-3 max-w-[54ch] text-[14px] leading-6 text-muted">
                {t(
                  "Laundry, cleaning, repairs and home help from approved local providers. Request a slot and pay cash on completion.",
                )}
              </p>
            </div>
            <Link href="/account" className="btn btn-ghost btn-sm">
              {t("My account")}
            </Link>
          </div>
        </section>
        <section className="container-wassl mt-6 pb-16">
          <ServicesMarket providers={providers} initialBookings={bookings} />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
