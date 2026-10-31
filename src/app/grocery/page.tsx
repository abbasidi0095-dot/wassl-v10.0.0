import Link from "next/link";
import { ArrowRight, Clock3, Heart, ListChecks, ShoppingBasket, Sparkles } from "lucide-react";
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

  return (
    <>
      <SiteHeader cities={cities} />
      <main className="container-wassl py-8">
        <section className="relative overflow-hidden rounded-[28px] bg-ink px-6 py-8 text-on-dark sm:px-10 sm:py-12">
          <div
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              background:
                "radial-gradient(circle at 85% 10%, rgba(232,163,61,.5), transparent 22rem), radial-gradient(circle at 10% 90%, rgba(15,110,110,.8), transparent 28rem)",
            }}
          />
          <div className="relative max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-extrabold text-saffron">
              <ShoppingBasket size={12} /> {t("Wassl Grocery")}
            </span>
            <h1 className="display mt-4 text-4xl sm:text-6xl">
              {t("The whole supermarket,")}
              <br />
              <span className="text-saffron">{t("at your door.")}</span>
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-on-dark/60">
              {t(
                "Fresh produce, pantry staples and household essentials from local supermarkets. Delivery, pickup, express and scheduled windows — with live stock.",
              )}
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-extrabold">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5">
                <Clock3 size={12} className="text-saffron" />
                {t("Open 24/7 where staffed")}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5">
                <Sparkles size={12} className="text-saffron" />
                {t("Express & scheduled")}
              </span>
            </div>
          </div>
        </section>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="eyebrow">{t("Local supermarkets")}</div>
            <h2 className="mt-1 text-2xl font-extrabold tracking-[-0.04em]">
              {t("Shop by store")}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/grocery/favorites" className="btn btn-ghost btn-sm">
              <Heart size={13} /> {t("Favourites")}
            </Link>
            <Link href="/grocery/lists" className="btn btn-ghost btn-sm">
              <ListChecks size={13} /> {t("Lists")}
            </Link>
            <Link href="/cities" className="text-xs font-extrabold text-teal">
              {t("Change city")} <ArrowRight size={12} className="inline rtl:-scale-x-100" />
            </Link>
          </div>
        </div>

        <div className="mt-4">
          <GroceryBrowser items={items} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
