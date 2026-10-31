import Link from "next/link";
import {
  ArrowRight,
  Bike,
  CheckCircle2,
  Clock3,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Star,
  Store as StoreIcon,
  Truck,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { StoreBrowser } from "@/components/store-browser";
import { MapView } from "@/components/map-view";
import { ProductTile } from "@/components/product-icon";
import { getCities, getPriorityCities, getStores } from "@/lib/db";
import { getTranslator } from "@/lib/i18n-server";
import { money } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { t } = await getTranslator();
  const cities = await getCities();
  const priority = await getPriorityCities();
  const stores = await getStores();
  const dakhla = cities.find((city) => city.slug === "dakhla") || priority[0];
  const dakhlaStores = stores.filter((store) => store.citySlug === "dakhla");
  const storeCount = new Map<string, number>();
  for (const store of stores) {
    storeCount.set(store.citySlug, (storeCount.get(store.citySlug) ?? 0) + 1);
  }

  return (
    <>
      <SiteHeader cities={cities} currentCity={dakhla} />
      <main>
        <section className="container-wassl grid gap-8 pb-10 pt-9 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-12 lg:pb-16 lg:pt-14">
          <div className="animate-rise">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal/15 bg-white/60 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-teal">
              <span className="status-dot live-dot" />
              {t("Now live in Dakhla & Laayoune")}
            </div>
            <h1 className="display mt-5 max-w-[620px] text-[52px] sm:text-[68px] lg:text-[78px]">
              {t("The South,")}
              <br />
              <span className="text-teal">{t("delivered.")}</span>
            </h1>
            <p className="mt-5 max-w-lg text-[15px] leading-7 text-ink/55">
              {t("Local restaurants, groceries and pharmacy essentials from Dakhla to Tarfaya. Pay cash on delivery and follow your driver live, block by block.")}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href={`/city/${dakhla.slug}`} className="btn btn-primary h-12 px-5">
                {t("Browse {city} stores", { city: dakhla.name })}
                <ArrowRight size={17} className="rtl:-scale-x-100" />
              </Link>
              <Link href="/cities" className="btn btn-ghost h-12 px-5">
                <MapPin size={16} />
                {t("All Moroccan cities")}
              </Link>
            </div>
            <div className="mt-8 grid max-w-lg grid-cols-3 gap-3">
              {[
                { value: `${priority.length}`, label: t("priority cities") },
                { value: `${stores.length}`, label: t("local stores") },
                { value: "COD", label: t("cash on delivery") },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-ink/10 bg-white/50 p-4">
                  <div className="text-2xl font-extrabold tracking-[-0.06em]">{item.value}</div>
                  <div className="mt-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-ink/40">
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="animate-rise-delay relative">
            <div className="absolute -start-3 -top-3 z-10 hidden rounded-2xl border border-ink/10 bg-paper/95 p-3 shadow-xl backdrop-blur sm:block">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal text-on-dark">
                  <Bike size={17} />
                </span>
                <div>
                  <div className="text-[11px] font-extrabold">{t("Driver on the way")}</div>
                  <div className="text-[9px] font-bold text-ink/40">8 min · Dakhla Grill</div>
                </div>
              </div>
            </div>
            <div className="overflow-hidden rounded-[30px] border border-white/70 bg-white/50 p-2 shadow-[0_40px_100px_-50px_rgba(15,60,58,.55)]">
              <MapView
                points={[
                  { id: "store", lat: 23.6927, lng: -15.9439, kind: "store", label: "Dakhla Grill" },
                  { id: "driver", lat: 23.6901, lng: -15.9478, kind: "driver", label: "Youssef · driver" },
                  { id: "customer", lat: 23.6882, lng: -15.9528, kind: "customer", label: "Drop-off" },
                ]}
                center={{ lat: 23.6905, lng: -15.948 }}
                zoom={14}
                height={390}
                route={[
                  [23.6927, -15.9439],
                  [23.6901, -15.9478],
                  [23.6882, -15.9528],
                ]}
                followDriverId="driver"
                interactive={false}
                className="rounded-[24px]"
              />
            </div>
            <div className="absolute -bottom-4 end-3 z-10 max-w-[250px] rounded-2xl border border-ink/10 bg-paper/95 p-4 shadow-xl backdrop-blur">
              <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider text-teal">
                <span className="status-dot live-dot" />
                {t("Live tracking")}
              </div>
              <div className="mt-2 text-sm font-extrabold leading-5">
                {t("Your order is 2 streets away.")}
              </div>
              <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-ink/40">
                <Star size={11} className="fill-saffron text-saffron" /> 4.9 {t("driver rating")}
              </div>
            </div>
          </div>
        </section>

        <section className="container-wassl">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Clock3,
                title: t("Fast, local delivery"),
                text: t("25–45 minutes in the city centre. Scheduled slots for longer routes."),
              },
              {
                icon: ShieldCheck,
                title: t("Cash on delivery"),
                text: t("Pay the driver in cash. No card, no surprise fees."),
              },
              {
                icon: Truck,
                title: t("Live driver tracking"),
                text: t("Watch your driver move on the map from pickup to your door."),
              },
              {
                icon: Phone,
                title: t("Human support"),
                text: t("WhatsApp or call us in Arabic, French or English."),
              },
            ].map((item) => (
              <div key={item.title} className="card-flat p-4">
                <item.icon size={19} className="text-teal" />
                <div className="mt-3 text-[13px] font-extrabold">{item.title}</div>
                <p className="mt-1 text-[11px] leading-5 text-ink/45">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="container-wassl mt-14 lg:mt-20" id="stores">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="eyebrow">{t("Open across the South")}</div>
              <h2 className="mt-2 text-4xl font-extrabold tracking-[-0.06em] lg:text-5xl">
                {t("Local favourites,")} <span className="text-teal">{t("one tap away.")}</span>
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-ink/45">
              {t("Restaurants, groceries, pharmacy and cafés. Every order is cash on delivery and tracked live.")}
            </p>
          </div>
          <div className="mt-6">
            <StoreBrowser stores={stores} />
          </div>
        </section>

        <section className="container-wassl mt-16 lg:mt-24">
          <div className="grid gap-4 md:grid-cols-5">
            <div className="card relative overflow-hidden bg-ink p-6 text-on-dark md:col-span-2">
              <div
                className="absolute inset-0 opacity-40"
                style={{
                  background:
                    "radial-gradient(circle at 100% 0%, rgba(232,163,61,.55), transparent 18rem)",
                }}
              />
              <div className="relative">
                <span className="pill pill-warm">{t("Southern corridor")}</span>
                <h2 className="mt-4 text-3xl font-extrabold tracking-[-0.055em]">
                  {t("From the lagoon")}
                  <br />
                  {t("to the Atlantic.")}
                </h2>
                <p className="mt-3 text-sm leading-6 text-on-dark/55">
                  {t("Five priority cities, one local operating model. Each city gets its own stores, drivers, zones and delivery fees.")}
                </p>
                <Link
                  href="/cities"
                  className="mt-6 inline-flex items-center gap-2 text-xs font-extrabold text-saffron"
                >
                  {t("Explore all cities")} <ArrowRight size={14} className="rtl:-scale-x-100" />
                </Link>
              </div>
            </div>

            <div className="grid gap-3 md:col-span-3 sm:grid-cols-2">
              {priority.map((city) => {
                const count = storeCount.get(city.slug) ?? 0;
                return (
                  <Link
                    key={city.id}
                    href={`/city/${city.slug}`}
                    className="card group flex flex-col justify-between p-4 transition hover:-translate-y-1 hover:border-teal/25"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-lg font-extrabold tracking-[-0.04em]">{city.name}</h3>
                        <p className="arabic mt-0.5 text-sm text-ink/35">{city.nameAr}</p>
                      </div>
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal/10 text-teal">
                        <MapPin size={16} />
                      </span>
                    </div>
                    <div className="mt-5 flex items-center justify-between text-[10px] font-bold text-ink/40">
                      <span>{count ? t("{count} stores live", { count }) : t("Coming soon")}</span>
                      <span className="inline-flex items-center gap-1 text-teal">
                        {t("Open")} <ArrowRight size={11} className="transition group-hover:translate-x-0.5 rtl:-scale-x-100" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="container-wassl mt-16 lg:mt-24">
          <div className="card grid gap-8 overflow-hidden p-6 md:grid-cols-2 md:items-center md:p-10">
            <div>
              <div className="eyebrow">{t("For local businesses")}</div>
              <h2 className="mt-2 text-4xl font-extrabold tracking-[-0.06em]">
                {t("Your store. Your drivers. One dashboard.")}
              </h2>
              <p className="mt-4 max-w-lg text-sm leading-6 text-ink/55">
                {t("Join Wassl and get a live order board, menu controls, COD reconciliation and a direct line to local drivers. No upfront subscription for the pilot.")}
              </p>
              <div className="mt-6 grid gap-2">
                {[
                  t("Accept orders from a tablet or phone"),
                  t("Set your own prep time, zones and fees"),
                  t("Weekly settlement minus a transparent commission"),
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-xs font-bold text-ink/60">
                    <CheckCircle2 size={15} className="text-teal" />
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-7 flex flex-wrap gap-2">
                <Link href="/login?next=merchant" className="btn btn-primary">
                  <StoreIcon size={16} />
                  {t("Open store dashboard")}
                </Link>
                <Link href="/login?next=driver" className="btn btn-ghost">
                  <Bike size={16} />
                  {t("Driver app")}
                </Link>
              </div>
            </div>
            <div className="relative rounded-3xl bg-cream p-5">
              <div className="rounded-2xl bg-white p-4 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink/35">
                    {t("New order · Dakhla Grill")}
                  </span>
                  <span className="pill pill-warm">COD</span>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <ProductTile name="Dakhla Smash" category="Burgers" className="h-12 w-12 rounded-xl" iconSize={22} />
                  <div>
                    <div className="text-sm font-extrabold">Dakhla Smash × 1</div>
                    <div className="text-[11px] text-ink/40">Loaded Fries × 1 · Lemonade</div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-ink/5 pt-3">
                  <span className="text-[11px] font-bold text-ink/40">{t("Collect from customer")}</span>
                  <span className="text-lg font-extrabold">{money(114)}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <span className="btn btn-primary btn-sm">{t("Accept order")}</span>
                  <span className="btn btn-ghost btn-sm">{t("View details")}</span>
                </div>
              </div>
              <div className="absolute -bottom-4 -end-3 rounded-2xl bg-teal p-3 text-on-dark shadow-xl">
                <div className="flex items-center gap-2 text-[10px] font-extrabold">
                  <Sparkles size={13} className="text-saffron" />
                  {t("Settled weekly")}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
