import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getProducts, getRefundRequests, getStores } from "@/lib/db";
import { StaffHeader } from "@/components/staff-header";
import { getTranslator } from "@/lib/i18n-server";
import { GroceryAdmin } from "./grocery-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Grocery operations" };

export default async function AdminGroceryPage() {
  const session = await requireRole("admin");
  const { t } = await getTranslator();
  const [stores, refunds] = await Promise.all([getStores(), getRefundRequests()]);
  const groceryStores = stores.filter((store) => store.category === "grocery");
  const products = (
    await Promise.all(groceryStores.map((store) => getProducts(store.id)))
  ).flat();

  return (
    <div className="staff-shell">
      <StaffHeader
        session={session}
        title="Grocery operations"
        subtitle="Inventory, stock health and refunds"
        links={[
          { href: "/admin", label: "Overview" },
          { href: "/admin/accounts", label: "Accounts" },
          { href: "/admin/grocery", label: "Grocery" },
          { href: "/admin/taxi", label: "Taxi" },
          { href: "/admin#orders", label: "Orders" },
        ]}
        accent="ink"
      />
      <main className="container-wassl py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="eyebrow">Wassl Grocery</div>
            <h1 className="display mt-2 text-[clamp(2rem,1.5rem+1.8vw,3rem)]">{t("Supermarket operations")}</h1>
            <p className="mt-1 text-sm text-ink/45">
              {t("Live inventory across {count} grocery stores.", { count: groceryStores.length })}
            </p>
          </div>
          <Link href="/grocery" className="btn btn-ghost btn-sm">
            {t("Open grocery storefront")}
          </Link>
        </div>
        <GroceryAdmin
          stores={groceryStores.map((store) => ({ id: store.id, name: store.name, citySlug: store.citySlug }))}
          initialProducts={products}
          initialRefunds={refunds}
        />
      </main>
    </div>
  );
}
