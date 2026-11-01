import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Clock3,
  Heart,
  ListChecks,
  ScanBarcode,
  ShoppingBasket,
  Sparkles,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getCities, getDrivers, getProducts, getStores } from "@/lib/db";
import { getPreferredCity } from "@/lib/city-preference";
import { groceryAvailability, grocerySettings } from "@/lib/grocery";
import { getTranslator } from "@/lib/i18n-server";
import { storePhoto } from "@/lib/store-images";
import { ProductTile } from "@/components/product-icon";
import { money } from "@/lib/utils";
import { GroceryBrowser } from "./grocery-browser";

export const dynamic = "force-dynamic";
export const metadata = { title: "Grocery" };

export default async function GroceryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const params = await searchParams;
  const { t } = await getTranslator();
  const [cities, stores, drivers] = await Promise.all([
    getCities(),
    getStores(),
    getDrivers(),
  ]);
  const currentCity = await getPreferredCity(cities);
  const groceryStores = stores.filter(
    (store) => store.category === "grocery" && store.citySlug === currentCity.slug,
  );
  const catalogues = await Promise.all(
    groceryStores.map(async (store) => ({
      store,
      products: await getProducts(store.id),
    })),
  );
  const popular = catalogues
    .flatMap(({ store, products }) =>
      products
        .filter((product) => product.available)
        .sort((a, b) => Number(b.popular) - Number(a.popular))
        .slice(0, 2)
        .map((product) => ({ product, store })),
    )
    .filter(({ product }) => product.popular)
    .slice(0, 8);

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
      <SiteHeader cities={cities} currentCity={currentCity} />
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
                <Link href="/grocery/basket" className="btn btn-primary btn-sm h-9">
                  <ShoppingBasket size={13} /> {t("Wassl Basket")}
                </Link>
                <Link href="/grocery/assistant" className="btn btn-ghost btn-sm h-9">
                  <Sparkles size={13} /> {t("Shopping assistant")}
                </Link>
                <Link href="/grocery/scan" className="btn btn-ghost btn-sm h-9">
                  <ScanBarcode size={13} /> {t("Scan barcode")}
                </Link>
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

          {popular.length ? (
            <div className="mt-8">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="headline">{t("Popular in the aisles")}</h2>
                  <p className="mt-1 text-[12px] text-muted">
                    {t("What neighbours are adding to their baskets right now.")}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {popular.map(({ product, store }) => (
                  <Link
                    key={product.id}
                    href={`/store/${store.slug}`}
                    className="aero-tile group flex items-center gap-3 rounded-[10px] border p-3 transition-colors hover:border-line-strong"
                  >
                    <ProductTile
                      name={product.name}
                      category={product.category}
                      image={product.image}
                      className="h-14 w-14 rounded-[6px]"
                      iconSize={22}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-semibold">{product.name}</div>
                      <div className="truncate text-[10px] text-muted">
                        {store.name} · {product.unit || t("each")}
                      </div>
                      <div className="mt-0.5 text-[12px] font-semibold tnum">
                        {money(product.price)}
                      </div>
                    </div>
                    <ArrowRight
                      size={13}
                      className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100"
                    />
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-8">
            <div className="flex items-end justify-between gap-4">
              <h2 className="headline">{t("Shop by store")}</h2>
            </div>
            <div className="mt-4">
              <GroceryBrowser
                items={items}
                initialQuery={(params.q ?? "").slice(0, 80)}
                initialFilter={
                  params.filter === "open" ||
                  params.filter === "delivery" ||
                  params.filter === "pickup" ||
                  params.filter === "express" ||
                  params.filter === "all"
                    ? params.filter
                    : "all"
                }
              />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
