import Link from "next/link";
import { ArrowRight, HeartPulse, Pill, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { StoreCard } from "@/components/store-card";
import { ProductTile } from "@/components/product-icon";
import { getCities, getCity, getProducts, getStores } from "@/lib/db";
import { getTranslator } from "@/lib/i18n-server";
import { money } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pharmacy" };

export default async function PharmacyPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>;
}) {
  const params = await searchParams;
  const { t, locale } = await getTranslator();
  const cities = await getCities();
  const stores = await getStores();
  const requested =
    (params.city ? await getCity(params.city) : undefined) ??
    (await getCity("dakhla")) ??
    cities[0];
  const pharmacies = stores.filter((store) => store.category === "pharmacy");
  const local = pharmacies.filter((store) => store.citySlug === requested.slug);
  const available = local.length ? local : pharmacies;
  const cityLabel = locale === "ar" ? requested.nameAr : requested.name;
  const partnerCity = available[0]
    ? cities.find((city) => city.slug === available[0].citySlug)
    : undefined;
  const partnerCityLabel = partnerCity
    ? locale === "ar"
      ? partnerCity.nameAr
      : partnerCity.name
    : "";

  const catalogues = await Promise.all(
    available.map(async (store) => ({
      store,
      products: (await getProducts(store.id)).filter((product) => product.available),
    })),
  );
  const popular = catalogues
    .flatMap(({ store, products }) =>
      products.slice(0, 5).map((product) => ({ product, store })),
    )
    .slice(0, 8);

  return (
    <>
      <SiteHeader cities={cities} currentCity={requested} />
      <main className="container-wassl pb-[112px] pt-6 md:pb-12">
        <section className="border-b border-line pb-7">
          <div className="flex items-center gap-2 text-[12px] text-muted">
            <span className="status-dot live-dot text-success" />
            {pharmacies.length === 1
              ? t("1 pharmacy partner")
              : t("{count} pharmacy partners", { count: pharmacies.length })}
          </div>
          <h1 className="display mt-3 max-w-[16ch] text-[clamp(2.2rem,1.5rem+3vw,3.8rem)]">
            {t("Pharmacy, at your door.")}
          </h1>
          <p className="mt-3 max-w-[56ch] text-[14px] leading-6 text-muted">
            {t(
              "Over-the-counter health, baby and personal care from licensed partners. Cash on delivery, handled discreetly.",
            )}
          </p>

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {[
              {
                icon: Pill,
                title: t("Everyday health"),
                note: t("Pain relief, vitamins, first aid"),
              },
              {
                icon: HeartPulse,
                title: t("Baby and care"),
                note: t("Wipes, sunscreen, personal care"),
              },
              {
                icon: ShieldCheck,
                title: t("Cash on delivery"),
                note: t("Pay when the order arrives"),
              },
            ].map((item) => (
              <div
                key={item.title}
                className="aero-tile flex items-center gap-3 rounded-[10px] border p-3"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[6px] bg-surface-2 text-brand">
                  <item.icon size={16} strokeWidth={1.7} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[12px] font-semibold">{item.title}</span>
                  <span className="block text-[10px] leading-4 text-muted">
                    {item.note}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </section>

        {!local.length && available.length ? (
          <section className="mt-5 rounded-[10px] border border-line bg-surface-2/60 p-4">
            <div className="text-[13px] font-semibold">
              {t("No pharmacy partner in {city} yet.", { city: cityLabel })}
            </div>
            <p className="mt-1 max-w-[60ch] text-[12px] leading-5 text-muted">
              {t(
                "Wassl is onboarding licensed pharmacies city by city. You can browse our {city} partner below.",
                { city: partnerCityLabel },
              )}
            </p>
            <Link
              href={`/cities`}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-brand"
            >
              {t("See cities")} <ArrowRight size={11} className="rtl:-scale-x-100" />
            </Link>
          </section>
        ) : null}

        <section className="mt-7">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="headline">
                {local.length
                  ? t("Pharmacies in {city}", { city: cityLabel })
                  : t("Pharmacies in {city}", { city: partnerCityLabel })}
              </h2>
              <p className="mt-1 text-[11px] text-muted">
                {t("Licensed partners with live stock and cash on delivery.")}
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {available.map((store) => (
              <StoreCard key={store.id} store={store} />
            ))}
          </div>
        </section>

        {popular.length ? (
          <section className="mt-8">
            <h2 className="headline">{t("Everyday health")}</h2>
            <p className="mt-1 text-[11px] text-muted">
              {t("A small, useful shelf from our pharmacy partners.")}
            </p>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {popular.map(({ product, store }) => (
                <Link
                  key={product.id}
                  href={`/store/${store.slug}?product=${product.id}`}
                  className="aero-tile group flex items-center gap-3 rounded-[10px] border p-3 transition-colors hover:border-line-strong"
                >
                  <ProductTile
                    name={product.name}
                    category={product.category}
                    image={product.image}
                    className="h-12 w-12 rounded-[6px]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-semibold">
                      {product.name}
                    </span>
                    <span className="block truncate text-[10px] text-muted">
                      {product.unit} · {store.name}
                    </span>
                  </span>
                  <span className="shrink-0 text-[12px] font-semibold tnum">
                    {money(product.price)}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <p className="mt-7 border-t border-line pt-4 text-[11px] leading-5 text-muted">
          {t(
            "Over-the-counter products only. Prescription medicines are not sold on Wassl.",
          )}
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
