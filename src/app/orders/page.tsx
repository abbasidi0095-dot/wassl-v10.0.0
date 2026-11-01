import { getCities } from "@/lib/db";
import { getPreferredCity } from "@/lib/city-preference";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PageHeader } from "@/components/page-header";
import { getTranslator } from "@/lib/i18n-server";
import { OrdersList } from "./orders-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "My orders" };

export default async function OrdersPage() {
  const [cities, { t }] = await Promise.all([getCities(), getTranslator()]);
  const currentCity = await getPreferredCity(cities);
  return (
    <>
      <SiteHeader cities={cities} currentCity={currentCity} />
      <main className="container-wassl">
        <PageHeader
          label={t("Order history")}
          title={t("Your orders")}
          description={t(
            "Deliveries, grocery runs and taxi rides. Orders placed on this device and those linked to your account appear here.",
          )}
        />
        <OrdersList />
      </main>
      <SiteFooter />
    </>
  );
}
