import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getCities, getDrivers, getProducts, getStore, getUserById } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getTranslator } from "@/lib/i18n-server";
import { groceryAvailability, grocerySettings } from "@/lib/grocery";
import { storePhoto } from "@/lib/store-images";
import { GroceryStore } from "./grocery-store";

export const dynamic = "force-dynamic";

export default async function GroceryStorePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = await getStore(slug);
  if (!store || store.category !== "grocery") notFound();

  const [cities, products, drivers, session, { t }] = await Promise.all([
    getCities(),
    getProducts(store.id),
    getDrivers(store.citySlug),
    getSession(),
    getTranslator(),
  ]);
  const user = session ? await getUserById(session.userId) : undefined;
  const activeDrivers = drivers.filter((driver) => driver.active).length;
  const settings = grocerySettings(store);
  const availability = groceryAvailability(store, activeDrivers);

  return (
    <>
      <SiteHeader cities={cities} currentCity={cities.find((city) => city.slug === store.citySlug)} />
      <main className="container-wassl py-6">
        <div className="mb-4 flex items-center gap-2 text-[11px] font-extrabold text-ink/40">
          <a href="/grocery" className="hover:text-ink">{t("Grocery")}</a>
          <span>/</span>
          <span className="text-ink">{store.name}</span>
        </div>
        <GroceryStore
          store={store}
          photo={storePhoto(store)}
          products={products}
          settings={settings}
          availability={availability}
          loyaltyPoints={user?.loyaltyPoints ?? 0}
          favorites={user?.favorites ?? []}
          signedIn={Boolean(session)}
        />
      </main>
      <SiteFooter />
    </>
  );
}
