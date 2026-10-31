import { notFound } from "next/navigation";
import { getCities, getOrderView } from "@/lib/db";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { OrderTracking } from "./order-tracking";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrderView(id);
  return { title: order ? `Order ${order.code}` : "Order" };
}

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrderView(id);
  if (!order) notFound();
  const cities = await getCities();
  return (
    <>
      <SiteHeader cities={cities} currentCity={order.city} />
      <main className="container-wassl pt-7 lg:pt-10">
        <OrderTracking initial={order} />
      </main>
      <SiteFooter />
    </>
  );
}
