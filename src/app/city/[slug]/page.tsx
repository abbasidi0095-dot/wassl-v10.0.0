import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, MapPin, Sprout } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { StoreBrowser } from "@/components/store-browser";
import { MapView } from "@/components/map-view";
import { getCities, getCity, getStores } from "@/lib/db";


export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const city = await getCity(slug);
  return {
    title: city ? `Delivery in ${city.name}` : "City",
    description: city
      ? `Order from local stores in ${city.name} with cash on delivery and live tracking.`
      : undefined,
  };
}

export default async function CityPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { slug } = await params;
  const filters = await searchParams;
  const city = await getCity(slug);
  if (!city) notFound();
  const cities = await getCities();
  const stores = (await getStores(slug)).filter((store) => store.isOpen);
  const mapPoints = stores.map((store) => ({
    id: store.id,
    lat: store.lat,
    lng: store.lng,
    kind: "store" as const,
    label: store.name,
  }));

  return (
    <>
      <SiteHeader cities={cities} currentCity={city} />
      <main>
        <section className="container-wassl">
          <div className="grid gap-8 border-b border-line pb-8 pt-8 lg:grid-cols-[1fr_0.9fr] lg:items-end lg:gap-12 lg:pt-12">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className={`status-dot ${city.launchStatus === "live" ? "live-dot" : ""} ${city.launchStatus === "live" ? "text-success" : ""}`} />
                  {city.launchStatus === "live" ? "Live now" : "Coming soon"}
                </span>
                <span className="text-line-strong">/</span>
                <span>{city.region}</span>
                {city.priority ? (
                  <>
                    <span className="text-line-strong">/</span>
                    <span>Priority city</span>
                  </>
                ) : null}
              </div>

              <h1 className="display mt-5">
                {city.name}
              </h1>
              <p className="arabic mt-2 text-[20px] text-muted">{city.nameAr}</p>

              <p className="lede mt-5 max-w-[48ch]" dir="auto">
                {stores.length
                  ? `${stores.length} local ${stores.length === 1 ? "store is" : "stores are"} open for delivery today. Pay cash when your order arrives.`
                  : `Wassl is preparing ${city.name}. Join the waitlist or apply as a local store and help us launch.`}
              </p>

              <dl className="mt-7 flex flex-wrap gap-x-8 gap-y-3 border-t border-line pt-5 text-[13px]">
                <div>
                  <dt className="text-muted">Stores open</dt>
                  <dd className="mt-0.5 font-medium tnum">{stores.length}</dd>
                </div>
                <div>
                  <dt className="text-muted">Payment</dt>
                  <dd className="mt-0.5 font-medium">Cash on delivery</dd>
                </div>
                <div>
                  <dt className="text-muted">Coverage</dt>
                  <dd className="mt-0.5 font-medium">{city.priority ? "Priority zone" : "City centre"}</dd>
                </div>
              </dl>

              <div className="mt-7 flex flex-wrap items-center gap-5">
                <a href="#stores" className="btn btn-primary">
                  Order now
                  <ArrowRight size={15} className="rtl:-scale-x-100" />
                </a>
                <Link href="/cities" className="text-[13px] font-medium text-brand">
                  Switch city
                </Link>
              </div>
            </div>

            <div className="relative overflow-hidden aero-tile rounded-[10px] border">
              <MapView
                points={mapPoints}
                center={{ lat: city.lat, lng: city.lng }}
                zoom={13}
                height={360}
                interactive={false}
                className="rounded-none"
              />
              <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
                <div>
                  <div className="text-[13px] font-medium">
                    {city.name} · {city.region}
                  </div>
                  <div className="text-[11px] text-muted tnum">
                    {stores.length} partner stores visible
                  </div>
                </div>
                <MapPin size={15} className="text-brand" />
              </div>
            </div>
          </div>
        </section>

        <section className="container-wassl mt-10 lg:mt-14" id="stores">
          {stores.length ? (
            <StoreBrowser
              stores={stores}
              initialQuery={(filters.q ?? "").slice(0, 80)}
              initialCategory={
                filters.category &&
                ["restaurant", "grocery", "pharmacy", "cafe", "gifts", "all"].includes(
                  filters.category,
                )
                  ? filters.category
                  : "all"
              }
            />
          ) : (
            <div className="border-y border-line py-16 text-center">
              <Sprout size={22} className="mx-auto text-brand" />
              <h2 className="mt-4 font-display text-3xl font-semibold tracking-[-0.03em]">
                {city.name} is on the map.
              </h2>
              <p className="mx-auto mt-2 max-w-md text-[13px] leading-6 text-muted">
                We are onboarding local stores and drivers. If you run a shop,
                restaurant or pharmacy here, you can be one of the first partners.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Link href="/login?next=merchant" className="btn btn-primary">
                  Apply as a store
                </Link>
                <Link href="/login?next=driver" className="btn btn-ghost">
                  Drive with Wassl
                </Link>
              </div>
            </div>
          )}
        </section>

        <section className="container-wassl mt-12">
          <div className="flex flex-wrap items-center justify-between gap-3 border-y border-line py-4">
            <div>
              <div className="text-[13px] font-medium">Not in {city.name} right now?</div>
              <div className="mt-0.5 text-[11px] text-muted">
                Wassl covers all Moroccan cities in the directory. Switch to another city.
              </div>
            </div>
            <Link href="/cities" className="btn btn-ghost btn-sm">
              Browse all cities <ArrowRight size={13} />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
