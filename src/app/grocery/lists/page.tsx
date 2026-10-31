import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getCities, getProducts, getStores, getUserById } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getTranslator } from "@/lib/i18n-server";
import { ListsView } from "./lists-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shopping lists" };

export default async function GroceryListsPage() {
  const session = await getSession();
  if (!session || session.role !== "customer") {
    redirect("/login?next=grocery/lists");
  }
  const [cities, user, stores, { t }] = await Promise.all([
    getCities(),
    getUserById(session.userId),
    getStores(),
    getTranslator(),
  ]);
  const grocery = stores.filter((store) => store.category === "grocery");
  const products = (await Promise.all(grocery.map((store) => getProducts(store.id)))).flat();
  const productMap = new Map(products.map((product) => [product.id, product]));
  const storeMap = new Map(grocery.map((store) => [store.id, store]));
  const lists = (user?.shoppingLists ?? []).map((list) => ({
    ...list,
    items: list.items
      .map((item) => {
        const product = productMap.get(item.productId);
        if (!product) return null;
        return {
          productId: item.productId,
          name: product.name,
          price: product.price,
          unit: product.unit,
          checked: Boolean(item.checked),
          qty: item.qty,
          storeName: storeMap.get(product.storeId)?.name ?? "",
          storeSlug: storeMap.get(product.storeId)?.slug ?? "",
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
  }));

  return (
    <>
      <SiteHeader cities={cities} />
      <main className="container-wassl py-8">
        <div className="max-w-2xl">
          <div className="eyebrow">{t("Wassl Grocery")}</div>
          <h1 className="display mt-2 text-4xl">{t("Shopping lists")}</h1>
          <p className="mt-2 text-sm text-muted">
            {t("Plan your shop, then add products to the cart from the store.")}
          </p>
        </div>
        <ListsView initialLists={lists} />
      </main>
      <SiteFooter />
    </>
  );
}
