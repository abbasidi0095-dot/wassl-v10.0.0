import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, MapPin, Sprout, Store, Truck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { StoreBrowser } from "@/components/store-browser";
import { MapView } from "@/components/map-view";
import { getCities, getCity, getStores } from "@/lib/db";
import { money } from "@/lib/utils";

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
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
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
        <section className="container-wassl pt-8 lg:pt-12">
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
            <div className="card relative overflow-hidden p-7 lg:p-10">
              <div
                className="absolute inset-0 opacity-70"
                style={{
                  background:
                    "radial-gradient(circle at 100% 0%, rgba(232,163,61,.18), transparent 24rem)",
                }}
              />
              <div className="relative">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="pill">
                    <span className="status-dot live-dot" />
                    {city.launchStatus === "live" ? "Live now" : "Coming soon"}
                  </span>
                  {city.priority ? <span className="pill pill-warm">Priority city</span> : null}
                </div>
                <h1 className="display mt-5 text-5xl sm:text-6xl">
                  {city.name}
                  <span className="arabic mt-2 block text-2xl font-semibold tracking-normal text-teal/60">
                    {city.nameAr}
                  </span>
                </h1>
                <p className="mt-4 max-w-lg text-sm leading-6 text-ink/55">
                  {stores.length
                    ? `${stores.length} local ${stores.length === 1 ? "store is" : "stores are"} open for delivery today. Pay cash when your order arrives.`
                    : `Wassl is preparing ${city.name}. Join the waitlist or apply as a local store and help us launch.`}
                </p>
                <div className="mt-6 grid max-w-md grid-cols-3 gap-2">
                  {[
                    { icon: Store, value: `${stores.length}`, label: "stores" },
                    { icon: Truck, value: "COD", label: "payment" },
                    { icon: MapPin, value: city.priority ? "Live" : "Soon", label: "status" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-ink/10 bg-white/55 p-3">
                      <item.icon size={15} className="text-teal" />
                      <div className="mt-2 text-lg font-extrabold tracking-tight">{item.value}</div>
                      <div className="text-[9px] font-extrabold uppercase tracking-wider text-ink/35">
                        {item.label}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  <a href="#stores" className="btn btn-primary">
                    Order now <ArrowRight size={15} />
                  </a>
                  <Link href="/cities" className="btn btn-ghost">
                    Switch city
                  </Link>
                </div>
              </div>
            </div>

            <div className="relative">
              <MapView
                points={mapPoints}
                center={{ lat: city.lat, lng: city.lng }}
                zoom={13}
                height={380}
                interactive={false}
                className="h-full min-h-[330px]"
              />
              <div className="absolute start-4 top-4 rounded-2xl border border-ink/10 bg-paper/95 px-4 py-3 shadow-xl backdrop-blur">
                <div className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-teal">
                  Delivery map
                </div>
                <div className="mt-1 text-sm font-extrabold">{city.name} · {city.region}</div>
                <div className="mt-1 text-[10px] font-bold text-ink/40">
                  {stores.length} partner stores visible
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="container-wassl mt-10 lg:mt-14" id="stores">
          {stores.length ? (
            <StoreBrowser stores={stores} />
          ) : (
            <div className="card grid place-items-center px-6 py-16 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-saffron/15 text-saffron-deep">
                <Sprout size={28} />
              </span>
              <h2 className="mt-5 text-3xl font-extrabold tracking-[-0.05em]">
                {city.name} is on the map.
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-ink/50">
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
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {stores.slice(0, 3).map((store) => (
                  <span key={store.id} className="pill">
                    {store.name} · {money(store.deliveryFee)} delivery
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="container-wassl mt-12">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white/45 px-5 py-4">
            <div>
              <div className="text-xs font-extrabold">Not in {city.name} right now?</div>
              <div className="mt-0.5 text-[11px] text-ink/45">
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
