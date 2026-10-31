import { getCities } from "@/lib/db";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { OrdersList } from "./orders-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "My orders" };

export default async function OrdersPage() {
  const cities = await getCities();
  return (
    <>
      <SiteHeader cities={cities} currentCity={cities.find((city) => city.slug === "dakhla")} />
      <main className="container-wassl pt-8 lg:pt-12">
        <div className="max-w-2xl">
          <div className="eyebrow">Order history</div>
          <h1 className="display mt-2 text-5xl">My orders</h1>
          <p className="mt-3 text-sm leading-6 text-ink/50">
            Orders placed on this device, plus any orders linked to your account.
            You can also open an order with its code.
          </p>
        </div>
        <OrdersList />
      </main>
      <SiteFooter />
    </>
  );
}
