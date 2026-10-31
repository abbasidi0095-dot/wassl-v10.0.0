import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock3, Heart, ListChecks, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getCities, getDrivers, getStores } from "@/lib/db";
import { groceryAvailability, grocerySettings } from "@/lib/grocery";
import { getTranslator } from "@/lib/i18n-server";
import { storePhoto } from "@/lib/store-images";
import { GroceryBrowser } from "./grocery-browser";

export const dynamic = "force-dynamic";
export const metadata = { title: "Grocery" };

export default async function GroceryPage() {
  const { t } = await getTranslator();
  const [cities, stores, drivers] = await Promise.all([
    getCities(),
    getStores(),
    getDrivers(),
  ]);
  const groceryStores = stores.filter((store) => store.category === "grocery");

  const items = groceryStores.map((store) => {
    const cityDrivers = drivers.filter(
      (driver) => driver.active && driver.citySlug === store.citySlug,
    ).length;
    return {
      store,
      photo: storePhoto(store),
      settings: grocerySettings(store),
      availability: groceryAvailability(store, cityDrivers),
    };
  });
  const featured = items[0];
  const openNow = items.filter((item) => item.availability.open).length;

  return (
    <>
      <SiteHeader cities={cities} />
      <main>
        <section className="container-wassl">
          <div className="grid gap-7 border-b border-line py-6 sm:py-8 lg:grid-cols-[1fr_0.78fr] lg:items-end lg:gap-12 lg:py-12">
            <div>
              <div className="flex items-center gap-2 text-[13px] text-muted">
                <span className="status-dot live-dot text-success" />
                {t("{count} supermarkets open now", { count: openNow })}
              </div>

              <h1 className="display mt-4 max-w-[16ch] text-[clamp(2.4rem,1.5rem+4.2vw,5rem)] sm:mt-5">
                {t("The whole supermarket,")} {t("at your door.")}
              </h1>

              <p
                className="lede mt-4 max-w-[52ch] text-[15px] leading-7 sm:mt-6 sm:text-[18px]"
                dir="auto"
              >
                {t(
                  "Aisles, units and live stock from local supermarkets. Delivery or pickup, express or scheduled — with overnight availability only when it is really staffed.",
                )}
              </p>

              <dl className="mt-6 grid max-w-lg grid-cols-3 gap-5 border-t border-line pt-5 sm:mt-8">
                {[
                  { value: `${items.length}`, label: t("supermarkets") },
                  { value: `${openNow}`, label: t("open right now") },
                  {
                    value: "30",
                    label: t("min express"),
                  },
                ].map((item) => (
                  <div key={item.label}>
                    <dt className="tnum font-display text-[24px] font-semibold leading-none">
                      {item.value}
                    </dt>
                    <dd className="mt-1.5 text-[11px] text-muted">{item.label}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-6 flex flex-wrap items-center gap-3 sm:mt-7">
                <Link href="/grocery/favorites" className="btn btn-ghost btn-sm h-9">
                  <Heart size={13} /> {t("Favourites")}
                </Link>
                <Link href="/grocery/lists" className="btn btn-ghost btn-sm h-9">
                  <ListChecks size={13} /> {t("Shopping lists")}
                </Link>
                <Link href="/cities" className="text-[13px] text-muted hover:text-ink">
                  {t("Change city")}
                </Link>
              </div>
            </div>

            {featured ? (
              <div className="relative">
                <div className="relative aspect-[16/9] overflow-hidden rounded-[10px] bg-surface-2 sm:aspect-[4/3]">
                  <Image
                    src={featured.photo}
                    alt={featured.store.name}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 40vw"
                    className="object-cover"
                  />
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold">
                      {featured.store.name}
                    </div>
                    <div className="text-[11px] text-muted">
                      {featured.store.landmark}
                    </div>
                  </div>
                  <Link
                    href={`/store/${featured.store.slug}`}
                    className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-brand"
                  >
                    {t("Shop")}
                    <ArrowRight size={11} className="rtl:-scale-x-100" />
                  </Link>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 size={13} className="text-brand" />
              {t("Scheduled windows and express")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Sparkles size={13} className="text-signal" />
              {t("Live stock and substitutions")}
            </span>
            <span>{t("Pay cash on delivery or at pickup")}</span>
          </div>

          <div className="mt-6">
            <div className="flex items-end justify-between gap-4">
              <h2 className="headline">{t("Shop by store")}</h2>
            </div>
            <div className="mt-4">
              <GroceryBrowser items={items} />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
