import { requireRole } from "@/lib/auth";
import {
  getBusinessAccountForUser,
  getBusinessOrders,
  getCities,
  getProducts,
  getStores,
} from "@/lib/db";
import { getPreferredCity } from "@/lib/city-preference";
import { getTranslator } from "@/lib/i18n-server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BusinessWorkspace } from "./business-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Wassl Business" };

export default async function BusinessPage() {
  const session = await requireRole("customer");
  const { t } = await getTranslator();
  const cities = await getCities();
  const currentCity = await getPreferredCity(cities);
  const stores = (await getStores()).filter((store) => store.category === "grocery");
  const catalog = await Promise.all(
    stores.map(async (store) => ({ store, products: await getProducts(store.id) })),
  );
  const [account, orders] = await Promise.all([
    getBusinessAccountForUser(session.userId),
    getBusinessOrders({ customerId: session.userId }),
  ]);

  return (
    <>
      <SiteHeader cities={cities} currentCity={currentCity} />
      <main className="container-wassl py-8 lg:py-12">
        <div className="mb-6 max-w-2xl">
          <div className="eyebrow">{t("Wassl Business")}</div>
          <h1 className="display mt-2 text-[clamp(2.2rem,1.6rem+2.5vw,3.4rem)]">
            {t("Wholesale for local businesses")}
          </h1>
          <p className="mt-3 text-[14px] leading-6 text-muted">
            {t(
              "Bulk groceries for restaurants, cafés, shops, hotels and offices. Approved accounts see wholesale prices. Cash settlement remains the default.",
            )}
          </p>
        </div>
        <BusinessWorkspace
          cities={cities}
          account={account ?? null}
          catalog={catalog}
          initialOrders={orders}
          defaultCity={currentCity.slug}
        />
      </main>
      <SiteFooter />
    </>
  );
}
