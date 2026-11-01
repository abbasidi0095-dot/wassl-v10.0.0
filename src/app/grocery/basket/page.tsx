import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getCities, getCity } from "@/lib/db";
import { BasketPlanner } from "./basket-planner";

export const dynamic = "force-dynamic";
export const metadata = { title: "Wassl Basket" };

export default async function GroceryBasketPage() {
  const cities = await getCities();
  const dakhla = (await getCity("dakhla")) ?? cities[0];

  return (
    <>
      <SiteHeader cities={cities} currentCity={dakhla} />
      <main className="container-wassl py-6 lg:py-10">
        <BasketPlanner cities={cities} defaultCity={dakhla.slug} />
      </main>
      <SiteFooter />
    </>
  );
}
