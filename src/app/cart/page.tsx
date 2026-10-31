import { getCities } from "@/lib/db";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CartView } from "./cart-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your cart" };

export default async function CartPage() {
  const cities = await getCities();
  return (
    <>
      <SiteHeader cities={cities} currentCity={cities.find((city) => city.slug === "dakhla")} />
      <main className="container-wassl pt-8 lg:pt-12">
        <div className="max-w-2xl">
          <div className="eyebrow">Your order</div>
          <h1 className="display mt-2 text-5xl">Cart & checkout</h1>
          <p className="mt-3 text-sm leading-6 text-ink/50">
            Review your items, then confirm cash on delivery. You will see your
            driver live after the store accepts.
          </p>
        </div>
        <CartView />
      </main>
      <SiteFooter />
    </>
  );
}
