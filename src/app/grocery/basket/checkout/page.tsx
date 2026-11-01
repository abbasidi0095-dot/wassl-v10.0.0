import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getCities, getCity } from "@/lib/db";
import { getPreferredCity } from "@/lib/city-preference";
import { BasketCheckout } from "./basket-checkout";

export const dynamic = "force-dynamic";
export const metadata = { title: "Basket checkout" };

export default async function GroceryBasketCheckoutPage() {
  const cities = await getCities();
  const currentCity = await getPreferredCity(cities);

  return (
    <>
      <SiteHeader cities={cities} currentCity={currentCity} />
      <main className="container-wassl py-6 lg:py-10">
        <BasketCheckout />
      </main>
      <SiteFooter />
    </>
  );
}
