import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getCities, getCity } from "@/lib/db";
import { BasketCheckout } from "./basket-checkout";

export const dynamic = "force-dynamic";
export const metadata = { title: "Basket checkout" };

export default async function GroceryBasketCheckoutPage() {
  const cities = await getCities();
  const dakhla = (await getCity("dakhla")) ?? cities[0];

  return (
    <>
      <SiteHeader cities={cities} currentCity={dakhla} />
      <main className="container-wassl py-6 lg:py-10">
        <BasketCheckout />
      </main>
      <SiteFooter />
    </>
  );
}
