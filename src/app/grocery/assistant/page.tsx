import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getCities, getCity } from "@/lib/db";
import { GroceryAssistant } from "./grocery-assistant";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shopping assistant" };

export default async function GroceryAssistantPage() {
  const cities = await getCities();
  const dakhla = (await getCity("dakhla")) ?? cities[0];

  return (
    <>
      <SiteHeader cities={cities} currentCity={dakhla} />
      <main className="container-wassl py-6 lg:py-10">
        <GroceryAssistant defaultCity={dakhla.slug} />
      </main>
      <SiteFooter />
    </>
  );
}
