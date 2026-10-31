import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getOrderViews, getProducts, getStore } from "@/lib/db";
import { StaffHeader } from "@/components/staff-header";
import { MerchantDashboard } from "./merchant-dashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Store dashboard" };

export default async function MerchantPage() {
  const session = await requireRole("merchant");
  if (!session.storeId) redirect("/login?next=merchant");
  const store = await getStore(session.storeId);
  if (!store) redirect("/login?next=merchant");
  const products = await getProducts(store.id);
  const orders = await getOrderViews({ storeId: store.id });

  return (
    <div className="staff-shell">
      <StaffHeader
        session={session}
        title={store.name}
        subtitle={`${store.citySlug} · store workspace`}
        links={
          store.category === "grocery"
            ? [{ href: "/merchant/grocery", label: "Grocery catalog & stock" }]
            : []
        }
      />
      <main className="container-wassl py-6">
        <MerchantDashboard
          store={store}
          initialProducts={products}
          initialOrders={orders}
        />
      </main>
    </div>
  );
}
