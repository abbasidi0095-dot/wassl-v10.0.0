import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getCities } from "@/lib/db";
import { CitiesExplorer } from "./cities-explorer";

export const dynamic = "force-dynamic";
export const metadata = { title: "All Moroccan cities" };

export default async function CitiesPage() {
  const cities = await getCities();
  return (
    <>
      <SiteHeader cities={cities} currentCity={cities.find((city) => city.slug === "dakhla")} />
      <main className="container-wassl pt-8 lg:pt-12">
        <div className="max-w-3xl">
          <div className="eyebrow">Coverage directory</div>
          <h1 className="display mt-3 text-5xl sm:text-6xl">
            All Morocco.
            <br />
            <span className="text-brand">The South first.</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted">
            Every city is in the Wassl directory. Priority operations are live in
            Dakhla, Laayoune, Boujdour, Esmara and Tarfaya, with the rest opening as
            local stores and drivers join.
          </p>
        </div>
        <div className="mt-8">
          <CitiesExplorer cities={cities} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
