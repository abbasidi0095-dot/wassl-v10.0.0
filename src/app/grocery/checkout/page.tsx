import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getCities } from "@/lib/db";
import { GroceryCheckout } from "./grocery-checkout";

export const dynamic = "force-dynamic";
export const metadata = { title: "Grocery checkout" };

export default async function GroceryCheckoutPage() {
  const cities = await getCities();
  return (
    <>
      <SiteHeader cities={cities} />
      <main className="container-wassl py-6">
        <div className="max-w-2xl">
          <div className="eyebrow">Wassl Grocery</div>
          <h1 className="display mt-2 text-4xl sm:text-5xl">Checkout</h1>
          <p className="mt-2 text-sm text-ink/50">
            Cash on delivery or collection. Stock is reserved when you place the order.
          </p>
        </div>
        <GroceryCheckout />
      </main>
      <SiteFooter />
    </>
  );
}
