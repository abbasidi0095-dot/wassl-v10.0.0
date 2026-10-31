import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getProducts, getStore } from "@/lib/db";
import { StaffHeader } from "@/components/staff-header";
import { grocerySettings } from "@/lib/grocery";
import { GroceryManager } from "./grocery-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Grocery catalog" };

export default async function MerchantGroceryPage() {
  const session = await requireRole("merchant");
  if (!session.storeId) redirect("/login?next=merchant");
  const store = await getStore(session.storeId);
  if (!store) redirect("/login?next=merchant");
  if (store.category !== "grocery") redirect("/merchant");

  const products = await getProducts(store.id);

  return (
    <div className="staff-shell">
      <StaffHeader
        session={session}
        title={store.name}
        subtitle={`${store.citySlug} · grocery workspace`}
        links={[{ href: "/merchant", label: "Order board" }]}
        accent="saffron"
      />
      <main className="container-wassl py-6">
        <GroceryManager
          store={store}
          initialProducts={products}
          initialSettings={grocerySettings(store)}
        />
      </main>
    </div>
  );
}
