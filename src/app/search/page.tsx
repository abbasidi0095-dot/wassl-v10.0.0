import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getCities, getCity } from "@/lib/db";
import { SearchExperience } from "./search-experience";

export const dynamic = "force-dynamic";
export const metadata = { title: "Search" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; city?: string }>;
}) {
  const params = await searchParams;
  const cities = await getCities();
  const citySlug = params.city && cities.some((city) => city.slug === params.city)
    ? params.city
    : "dakhla";
  const currentCity = (await getCity(citySlug)) ?? cities[0];

  return (
    <>
      <SiteHeader cities={cities} currentCity={currentCity} />
      <main className="container-wassl py-5 lg:py-8">
        <SearchExperience
          cities={cities}
          initialQuery={(params.q ?? "").slice(0, 80)}
          initialCity={citySlug}
        />
      </main>
      <SiteFooter />
    </>
  );
}
