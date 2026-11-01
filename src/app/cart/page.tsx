import { getCities } from "@/lib/db";
import { getPreferredCity } from "@/lib/city-preference";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PageHeader } from "@/components/page-header";
import { getTranslator } from "@/lib/i18n-server";
import { CartView } from "./cart-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your cart" };

export default async function CartPage() {
  const [cities, { t }] = await Promise.all([getCities(), getTranslator()]);
  const currentCity = await getPreferredCity(cities);
  return (
    <>
      <SiteHeader cities={cities} currentCity={currentCity} />
      <main className="container-wassl">
        <PageHeader
          label={t("Your order")}
          title={t("Cart")}
          description={t(
            "Review your items, then confirm cash on delivery. You will see your driver live after the store accepts.",
          )}
        />
        <CartView />
      </main>
      <SiteFooter />
    </>
  );
}
