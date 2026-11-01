import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getCities, getCity } from "@/lib/db";
import { getPreferredCity } from "@/lib/city-preference";
import { GroceryAssistant } from "./grocery-assistant";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shopping assistant" };

export default async function GroceryAssistantPage() {
  const cities = await getCities();
  const currentCity = await getPreferredCity(cities);

  return (
    <>
      <SiteHeader cities={cities} currentCity={currentCity} />
      <main className="container-wassl py-6 lg:py-10">
        <GroceryAssistant defaultCity={currentCity.slug} />
      </main>
      <SiteFooter />
    </>
  );
}
