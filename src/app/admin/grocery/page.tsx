import Link from "next/link";
import { requireRole } from "@/lib/auth";
import {
  getCities,
  getOrders,
  getProducts,
  getRefundRequests,
  getStores,
  getDb,
} from "@/lib/db";
import { inventoryIntelligence } from "@/lib/inventory";
import { StaffHeader } from "@/components/staff-header";
import { getTranslator } from "@/lib/i18n-server";
import { GroceryAdmin } from "./grocery-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Grocery operations" };

export default async function AdminGroceryPage() {
  const session = await requireRole("admin");
  const { t } = await getTranslator();
  const [stores, refunds, cities] = await Promise.all([
    getStores(),
    getRefundRequests(),
    getCities(),
  ]);
  const groceryStores = stores.filter((store) => store.category === "grocery");
  const products = (
    await Promise.all(groceryStores.map((store) => getProducts(store.id)))
  ).flat();
  const [orders, db] = await Promise.all([getOrders(), getDb()]);
  const inventory = inventoryIntelligence({
    stores: groceryStores,
    products,
    orders,
    reservations: db.stockReservations ?? [],
  });

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
          { href: "/admin/express", label: "Express" },
          { href: "/admin/services", label: "Services" },
          { href: "/admin/business", label: "Business" },
          { href: "/admin/messages", label: "Messages" },
        ]}
        accent="ink"
      />
      <main className="container-wassl py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="eyebrow">Wassl Grocery</div>
            <h1 className="display mt-2 text-[clamp(2rem,1.5rem+1.8vw,3rem)]">{t("Supermarket operations")}</h1>
            <p className="mt-1 text-sm text-muted">
              {t("Live inventory across {count} grocery stores.", { count: groceryStores.length })}
            </p>
          </div>
          <Link href="/grocery" className="btn btn-ghost btn-sm">
            {t("Open grocery storefront")}
          </Link>
        </div>
        <GroceryAdmin
          stores={groceryStores}
          cities={cities}
          initialProducts={products}
          initialRefunds={refunds}
          inventory={inventory}
        />
      </main>
    </div>
  );
}
