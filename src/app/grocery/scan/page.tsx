import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getCities, getCity } from "@/lib/db";
import { BarcodeScanner } from "./barcode-scanner";

export const dynamic = "force-dynamic";
export const metadata = { title: "Barcode scanner" };

export default async function GroceryScanPage() {
  const cities = await getCities();
  const dakhla = (await getCity("dakhla")) ?? cities[0];

  return (
    <>
      <SiteHeader cities={cities} currentCity={dakhla} />
      <main className="container-wassl py-6 lg:py-10">
        <BarcodeScanner />
      </main>
      <SiteFooter />
    </>
  );
}
