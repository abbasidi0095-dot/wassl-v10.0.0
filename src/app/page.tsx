import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Bike,
  CarTaxiFront,
  Clock3,
  MapPin,
  Pill,
  ShoppingBasket,
  UtensilsCrossed,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { StoreBrowser } from "@/components/store-browser";
import { MapView } from "@/components/map-view";
import { dashboardStats, getCities, getPriorityCities, getStores } from "@/lib/db";
import { getTranslator } from "@/lib/i18n-server";
import { storePhoto } from "@/lib/store-images";
import { money } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { t, locale } = await getTranslator();
  const [cities, priority, stores, stats] = await Promise.all([
    getCities(),
    getPriorityCities(),
    getStores(),
    dashboardStats(),
  ]);
  const dakhla = cities.find((city) => city.slug === "dakhla") || priority[0];
  const cityLabel = locale === "ar" ? dakhla.nameAr : dakhla.name;
  const groceryStores = stores.filter((store) => store.category === "grocery");
  const featuredGrocery =
    groceryStores.find((store) => store.slug === "sahara-market") ?? groceryStores[0];
  const featuredStore =
    stores.find((store) => store.slug === "dakhla-grill") ??
    stores.find((store) => store.citySlug === "dakhla") ??
    stores[0];
  const storeCount = new Map<string, number>();
  for (const store of stores) {
    storeCount.set(store.citySlug, (storeCount.get(store.citySlug) ?? 0) + 1);
  }

  const doors = [
    {
      href: "/grocery",
      label: t("Grocery"),
      note: t("Supermarkets, 24/7 where staffed"),
      icon: ShoppingBasket,
      count: groceryStores.length,
    },
    {
      href: `/city/${dakhla.slug}`,
      label: t("Restaurants"),
      note: t("Local kitchens and cafés"),
      icon: UtensilsCrossed,
      count: stores.filter((store) => store.category === "restaurant").length,
    },
    {
      href: `/city/${dakhla.slug}`,
      label: t("Pharmacy"),
      note: t("Essentials, late hours"),
      icon: Pill,
      count: stores.filter((store) => store.category === "pharmacy").length,
    },
    {
      href: "/taxi",
      label: t("Taxi"),
      note: t("Cash fare, live route"),
      icon: CarTaxiFront,
      count: null,
    },
  ];

  return (
    <>
      <SiteHeader cities={cities} currentCity={dakhla} />
      <main>
        {/* Hero: type left, one real live panel right. */}
        <section className="container-wassl grid gap-10 pb-12 pt-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-end lg:gap-14 lg:pb-16 lg:pt-16">
          <div>
            <div className="flex items-center gap-2 text-[13px] font-medium text-muted">
              <span className="status-dot live-dot text-success" />
              {t("Now delivering in {city}", { city: cityLabel })}
              <span className="text-line-strong">/</span>
              <span className="tnum">06:00–02:00</span>
            </div>

            <h1 className="display mt-6">
              {t("The South,")}
              <br />
              {t("delivered.").replace(".", "")}
              <span className="text-signal">.</span>
            </h1>

            <p className="lede mt-7 max-w-[46ch]" dir="auto">
              {t(
                "Restaurants, a full supermarket, pharmacy essentials and taxi rides — from Dakhla to Tarfaya. Cash on arrival, tracked live.",
              )}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link href={`/city/${dakhla.slug}`} className="btn btn-primary btn-lg">
                {t("Order from {city}", { city: cityLabel })}
                <ArrowRight size={17} className="rtl:-scale-x-100" />
              </Link>
              <Link
                href="/grocery"
                className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-medium text-ink underline decoration-line-strong decoration-1 underline-offset-4 transition-colors hover:decoration-ink"
              >
                {t("Shop 24/7 groceries")}
                <ArrowUpRight size={15} className="rtl:-scale-x-100" />
              </Link>
            </div>

            <dl className="mt-10 grid max-w-xl grid-cols-2 gap-y-5 border-t border-line pt-6 sm:grid-cols-4 sm:gap-x-6">
              {[
                { value: String(priority.length), label: t("cities live") },
                { value: String(stores.length), label: t("local stores") },
                { value: "24/7", label: t("grocery where staffed") },
                { value: "COD", label: t("cash on delivery") },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="tnum font-display text-[26px] font-semibold leading-none tracking-[-0.03em]">
                    {item.value}
                  </dt>
                  <dd className="mt-2 text-[11px] leading-4 text-muted">
                    {item.label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {featuredStore ? (
            <div className="overflow-hidden rounded-[10px] border border-line bg-surface">
              <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
                <div className="flex min-w-0 items-center gap-2 text-[13px] font-medium">
                  <span className="status-dot live-dot text-success" />
                  <span className="truncate">
                    {t("Live in {city}", { city: cityLabel })}
                  </span>
                </div>
                <span className="shrink-0 text-[11px] text-muted tnum">
                  {featuredStore.prepTime}–{featuredStore.prepTime + 10} min
                </span>
              </div>
              <MapView
                points={[
                  {
                    id: "store",
                    lat: featuredStore.lat,
                    lng: featuredStore.lng,
                    kind: "store",
                    label: featuredStore.name,
                  },
                  {
                    id: "driver",
                    lat: featuredStore.lat - 0.003,
                    lng: featuredStore.lng - 0.004,
                    kind: "driver",
                    label: "Youssef · driver",
                  },
                  {
                    id: "customer",
                    lat: featuredStore.lat - 0.006,
                    lng: featuredStore.lng - 0.008,
                    kind: "customer",
                    label: t("Drop-off"),
                  },
                ]}
                center={{
                  lat: featuredStore.lat - 0.003,
                  lng: featuredStore.lng - 0.004,
                }}
                zoom={14}
                height={330}
                route={[
                  [featuredStore.lat, featuredStore.lng],
                  [featuredStore.lat - 0.003, featuredStore.lng - 0.004],
                  [featuredStore.lat - 0.006, featuredStore.lng - 0.008],
                ]}
                followDriverId="driver"
                interactive={false}
                className="rounded-none"
              />
              <div className="flex items-center justify-between gap-4 border-t border-line px-4 py-3.5">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold">
                    {featuredStore.name}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-muted">
                    {featuredStore.landmark} · {t("Cash on delivery")}
                  </div>
                </div>
                <Link
                  href={`/store/${featuredStore.slug}`}
                  className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-brand"
                >
                  {t("Open store")}
                  <ArrowRight size={13} className="rtl:-scale-x-100" />
                </Link>
              </div>
            </div>
          ) : null}
        </section>

        {/* Four doors, one per service. */}
        <section className="container-wassl">
          <div className="flex items-end justify-between gap-4 border-t border-line pt-6">
            <h2 className="text-[13px] font-semibold text-muted">
              {t("What do you need?")}
            </h2>
            <Link href="/cities" className="text-[13px] font-medium text-brand">
              {t("All Moroccan cities")}
            </Link>
          </div>
          <div className="mt-4 grid border-s border-t border-line sm:grid-cols-2 lg:grid-cols-4">
            {doors.map((door) => (
              <Link
                key={door.label}
                href={door.href}
                className="group relative flex items-center gap-4 border-e border-b border-line bg-surface p-4 transition-colors hover:bg-surface-2 sm:block sm:min-h-[136px] sm:p-5"
              >
                <door.icon
                  size={20}
                  strokeWidth={1.6}
                  className="shrink-0 text-ink/70 sm:mb-8"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-display text-[22px] font-semibold tracking-[-0.03em] sm:text-[24px]">
                      {door.label}
                    </span>
                    {door.count !== null ? (
                      <span className="text-[11px] text-muted tnum">
                        {door.count}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[13px] text-muted sm:mt-1">{door.note}</p>
                </div>
                <ArrowUpRight
                  size={16}
                  className="shrink-0 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 rtl:-scale-x-100 sm:absolute sm:end-5 sm:top-5"
                />
              </Link>
            ))}
          </div>
        </section>

        {/* Grocery feature on an ink field. */}
        {featuredGrocery ? (
          <section className="field-ink mt-16 border-y border-line lg:mt-24">
            <div className="container-wassl grid gap-10 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16 lg:py-16">
              <div>
                <p className="text-[13px] font-medium text-saffron">
                  {t("Wassl Grocery")}
                </p>
                <h2 className="display-sm mt-3 max-w-[18ch] text-[clamp(2.1rem,1.5rem+2vw,3.4rem)]">
                  {t("The whole supermarket, at your door.")}
                </h2>
                <p className="mt-5 max-w-[46ch] text-[15px] leading-6 opacity-60">
                  {t(
                    "Aisles, units, live stock, size variants and substitutions — delivery or pickup, express or scheduled. Open overnight only when the store is staffed.",
                  )}
                </p>
                <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-white/15 pt-5">
                  {[
                    { value: "21+", label: t("aisle products") },
                    { value: "30", label: t("min express") },
                    { value: "4", label: t("delivery windows") },
                  ].map((item) => (
                    <div key={item.label}>
                      <dt className="tnum font-display text-[24px] font-semibold leading-none">
                        {item.value}
                      </dt>
                      <dd className="mt-1.5 text-[11px] leading-4 opacity-50">
                        {item.label}
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-8 flex flex-wrap items-center gap-5">
                  <Link
                    href={`/store/${featuredGrocery.slug}`}
                    className="btn btn-lg bg-white text-ink hover:bg-white/85"
                  >
                    {t("Shop {store}", { store: featuredGrocery.name })}
                    <ArrowRight size={16} className="rtl:-scale-x-100" />
                  </Link>
                  <Link
                    href="/grocery"
                    className="text-[13px] font-medium text-saffron underline decoration-saffron/40 underline-offset-4 hover:decoration-saffron"
                  >
                    {t("All supermarkets")}
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-5 grid-rows-5 gap-3">
                <div className="relative col-span-3 row-span-3 overflow-hidden rounded-[8px]">
                  <Image
                    src={storePhoto(featuredGrocery)}
                    alt={featuredGrocery.name}
                    fill
                    sizes="(max-width: 1024px) 60vw, 40vw"
                    className="object-cover"
                  />
                </div>
                <div className="col-span-2 row-span-2 flex flex-col justify-between rounded-[8px] border border-white/15 p-4">
                  <Clock3 size={17} className="text-saffron" />
                  <div>
                    <div className="text-[13px] font-medium">
                      {t("Open overnight")}
                    </div>
                    <div className="mt-1 text-[11px] leading-4 opacity-50">
                      {t("Delivery only with overnight staff and a driver online.")}
                    </div>
                  </div>
                </div>
                <div className="col-span-2 row-span-3 flex flex-col justify-between rounded-[8px] border border-white/15 p-4">
                  <Bike size={17} className="text-saffron" />
                  <div>
                    <div className="text-[13px] font-medium">
                      {t("Pickup or delivery")}
                    </div>
                    <div className="mt-1 text-[11px] leading-4 opacity-50">
                      {t("Pay cash at collection or on arrival.")}
                    </div>
                    <div className="mt-3 text-[11px] opacity-50 tnum">
                      {t("Ready in {min} min", { min: featuredGrocery.prepTime })}
                    </div>
                    <Link
                      href={`/store/${featuredGrocery.slug}`}
                      className="mt-4 inline-flex items-center gap-1 text-[11px] font-medium text-saffron"
                    >
                      {t("Order pickup")}
                      <ArrowRight size={11} className="rtl:-scale-x-100" />
                    </Link>
                  </div>
                </div>
                <div className="relative col-span-3 row-span-2 overflow-hidden rounded-[8px]">
                  <Image
                    src={
                      groceryStores[1]
                        ? storePhoto(groceryStores[1])
                        : storePhoto(featuredGrocery)
                    }
                    alt={groceryStores[1]?.name ?? featuredGrocery.name}
                    fill
                    sizes="(max-width: 1024px) 60vw, 40vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-ink/20" />
                  <div className="absolute inset-x-3 bottom-3 text-[11px] font-medium text-on-dark">
                    {groceryStores[1]?.name ?? featuredGrocery.name}
                    <span className="ms-1 opacity-60">
                      · {groceryStores[1]?.citySlug ?? featuredGrocery.citySlug}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section className="container-wassl pt-14 lg:pt-20" id="stores">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="headline">{t("Open across the South")}</h2>
              <p className="mt-2 max-w-[54ch] text-[14px] leading-6 text-muted">
                {t(
                  "Local kitchens, supermarkets, pharmacy and cafés. Every order is cash on delivery and tracked live.",
                )}
              </p>
            </div>
            <Link href={`/city/${dakhla.slug}`} className="text-[13px] font-medium text-brand">
              {t("All {city} stores", { city: cityLabel })}
            </Link>
          </div>
          <div className="mt-6">
            <StoreBrowser stores={stores} />
          </div>
        </section>

        {/* Cities as a ruled index, not cards. */}
        <section className="container-wassl mt-16 lg:mt-24">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div>
              <h2 className="headline">{t("Five cities, one operating model.")}</h2>
              <p className="mt-3 max-w-[42ch] text-[14px] leading-6 text-muted">
                {t(
                  "Each city keeps its own stores, drivers, zones and fees — so the promise on screen is the one we can keep.",
                )}
              </p>
              <Link
                href="/cities"
                className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand"
              >
                {t("Explore all Moroccan cities")}
                <ArrowRight size={14} className="rtl:-scale-x-100" />
              </Link>
            </div>
            <ol className="border-t border-line">
              {priority.map((city) => {
                const count = storeCount.get(city.slug) ?? 0;
                return (
                  <li key={city.id}>
                    <Link
                      href={`/city/${city.slug}`}
                      className="group flex items-baseline justify-between gap-4 border-b border-line py-4 transition-colors hover:text-brand"
                    >
                      <span className="flex min-w-0 items-baseline gap-3">
                        <span className="font-display text-[20px] font-semibold tracking-[-0.02em]">
                          {city.name}
                        </span>
                        <span className="arabic text-[13px] text-muted">
                          {city.nameAr}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-baseline gap-6 text-[13px] text-muted tnum">
                        <span>
                          {count
                            ? t("{count} stores", { count })
                            : t("Coming soon")}
                        </span>
                        <ArrowRight
                          size={14}
                          className="text-brand transition-transform group-hover:translate-x-1 rtl:-scale-x-100"
                        />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* Business: a real order row as the visual. */}
        <section className="container-wassl mt-16 lg:mt-24">
          <div className="grid gap-4 lg:grid-cols-[1fr_0.85fr] lg:items-start">
            <div className="rounded-[10px] border border-line bg-surface p-7 sm:p-10">
              <p className="text-[13px] font-medium text-brand">
                {t("For local businesses")}
              </p>
              <h2 className="headline mt-3 max-w-[20ch]">
                {t("Your store. One dashboard.")}
              </h2>
              <p className="mt-4 max-w-[48ch] text-[14px] leading-6 text-muted">
                {t(
                  "A live order board, catalog and stock controls, COD reconciliation and a direct line to local drivers. No upfront subscription for the pilot.",
                )}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/login?next=merchant" className="btn btn-primary">
                  {t("Open store dashboard")}
                </Link>
                <Link href="/login?next=driver" className="btn btn-ghost">
                  {t("Driver app")}
                </Link>
              </div>
            </div>
            <div className="rounded-[10px] border border-line bg-surface p-7 sm:p-10">
              <div className="flex items-center justify-between text-[11px] text-muted">
                <span>{t("Order board preview")}</span>
                <span className="tnum">14:32</span>
              </div>
              <div className="mt-4 divide-y divide-line border-y border-line">
                {[
                  { code: "WS-4821", label: t("2 items"), amount: 114, state: t("New") },
                  { code: "WS-4820", label: t("Grocery pickup"), amount: 68, state: t("Ready") },
                  { code: "WS-4819", label: t("1 item"), amount: 49, state: t("On route") },
                ].map((row) => (
                  <div key={row.code} className="flex items-center justify-between gap-3 py-3.5">
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium">{row.code}</div>
                      <div className="text-[11px] text-muted">{row.label}</div>
                    </div>
                    <div className="text-end">
                      <div className="text-[13px] font-semibold tnum">
                        {money(row.amount)}
                      </div>
                      <div className="text-[11px] text-muted">{row.state}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[11px] text-muted">
                  <MapPin size={13} />
                  {t("Cash collected is reconciled at the end of each shift.")}
                </div>
                <Link
                  href="/login?next=merchant"
                  className="shrink-0 text-[11px] font-medium text-brand"
                >
                  {t("Open the board")}
                </Link>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3">
                <div>
                  <dt className="text-[11px] text-muted">{t("Orders in flight")}</dt>
                  <dd className="mt-0.5 text-[15px] font-semibold tnum">{stats.liveOrders}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-muted">{t("Delivered GMV")}</dt>
                  <dd className="mt-0.5 text-[15px] font-semibold tnum">{money(stats.gmv)}</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
