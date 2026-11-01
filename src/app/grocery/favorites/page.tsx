import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getCities, getProducts, getStores, getUserById } from "@/lib/db";
import { getPreferredCity } from "@/lib/city-preference";
import { getSession } from "@/lib/auth";
import { getTranslator } from "@/lib/i18n-server";
import { FavoritesView } from "./favorites-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Grocery favourites" };

export default async function GroceryFavoritesPage() {
  const session = await getSession();
  if (!session || session.role !== "customer") {
    redirect("/login?next=grocery/favorites");
  }
  const [cities, user, stores, { t }] = await Promise.all([
    getCities(),
    getUserById(session.userId),
    getStores(),
    getTranslator(),
  ]);
  const currentCity = await getPreferredCity(cities);
  const grocery = stores.filter((store) => store.category === "grocery");
  const products = (await Promise.all(grocery.map((store) => getProducts(store.id)))).flat();
  const favorites = (user?.favorites ?? [])
    .map((id) => products.find((product) => product.id === id))
    .filter((product): product is NonNullable<typeof product> => Boolean(product));
  const storeById = new Map(grocery.map((store) => [store.id, store]));

  return (
    <>
      <SiteHeader cities={cities} currentCity={currentCity} />
      <main className="container-wassl py-8">
        <div className="max-w-2xl">
          <div className="eyebrow">{t("Wassl Grocery")}</div>
          <h1 className="display mt-2 text-4xl">{t("Your favourites")}</h1>
          <p className="mt-2 text-sm text-muted">
            {t("Products you saved from local supermarkets.")}
          </p>
        </div>
        <FavoritesView
          items={favorites.map((product) => ({
            product,
            storeName: storeById.get(product.storeId)?.name ?? "",
            storeSlug: storeById.get(product.storeId)?.slug ?? "",
          }))}
        />
      </main>
      <SiteFooter />
    </>
  );
}
