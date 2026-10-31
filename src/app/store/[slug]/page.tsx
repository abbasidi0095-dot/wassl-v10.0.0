import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Clock3,
  Database,
  MapPin,
  ShieldCheck,
  Star,
  Truck,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { StoreMenu } from "@/components/store-menu";
import { CartMini } from "@/components/cart-mini";
import { MapView } from "@/components/map-view";
import { getCities, getCity, getProducts, getStore } from "@/lib/db";
import { getOpenState } from "@/lib/hours";
import { storePhoto } from "@/lib/store-images";
import { categoryLabel, money } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PRICE_LABEL = { 1: "Budget", 2: "Mid-range", 3: "Premium" } as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = await getStore(slug);
  return {
    title: store ? `${store.name} — ${store.citySlug}` : "Store",
    description: store?.tagline,
  };
}

export default async function StorePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = await getStore(slug);
  if (!store) notFound();
  if (store.category === "grocery") redirect(`/grocery/${store.slug}`);
  const city = await getCity(store.citySlug);
  if (!city) notFound();
  const products = await getProducts(store.id);
  const cities = await getCities();
  const openState = getOpenState(store);
  const hasRating = store.rating > 0 && store.reviews > 0;

  return (
    <>
      <SiteHeader cities={cities} currentCity={city} />
      <main>
        <div className="container-wassl pt-5">
          <div className="flex items-center gap-2 text-[11px] font-bold text-ink/35">
            <Link href={`/city/${city.slug}`} className="inline-flex items-center gap-1 hover:text-teal">
              <ArrowLeft size={13} /> {city.name}
            </Link>
            <span>/</span>
            <span className="text-ink/60">{store.name}</span>
          </div>
        </div>

        <section className="container-wassl mt-4">
          <div className="card overflow-hidden">
            <div className="store-cover store-cover--hero relative h-56 px-5 py-5 sm:h-72 sm:px-8 sm:py-7">
              <Image
                src={storePhoto(store)}
                alt={`${store.name} storefront`}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 1180px"
                className="object-cover"
              />
              <div className="relative z-10 flex h-full flex-col justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-ink/70 backdrop-blur">
                    <span className={`status-dot ${openState.open ? "live-dot" : ""}`} />
                    {openState.open ? "Open now" : openState.label} · {openState.detail}
                  </span>
                  {store.dataOrigin === "marocapis" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-ink/35 px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-wider text-on-dark/90 backdrop-blur">
                      <BadgeCheck size={11} /> Verified listing
                    </span>
                  ) : null}
                </div>
                <div className="text-on-dark">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-on-dark/60">
                    <span>{categoryLabel(store.category)}</span>
                    <span>·</span>
                    <span>{city.name}</span>
                    {store.priceLevel ? (
                      <>
                        <span>·</span>
                        <span>{PRICE_LABEL[store.priceLevel]}</span>
                      </>
                    ) : null}
                  </div>
                  <h1 className="mt-1 text-3xl font-extrabold tracking-[-0.055em] sm:text-4xl">
                    {store.name}
                  </h1>
                  {store.nameAr ? (
                    <p className="arabic mt-1 text-sm text-on-dark/65">{store.nameAr}</p>
                  ) : null}
                  <p className="mt-2 max-w-xl text-[12px] leading-5 text-on-dark/70">
                    {store.tagline}
                  </p>
                </div>
              </div>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-[1.4fr_1fr] sm:p-6">
              <div>
                <p className="text-sm leading-6 text-ink/60">{store.description}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(store.tags ?? []).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-teal/8 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wide text-teal"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {hasRating ? (
                    <span className="pill">
                      <Star size={12} className="fill-saffron text-saffron" />
                      {store.rating.toFixed(1)} · {store.reviews.toLocaleString("en-US")} reviews
                    </span>
                  ) : (
                    <span className="pill pill-warm">New on Wassl</span>
                  )}
                  <span className="pill">
                    <Clock3 size={12} />
                    {store.prepTime}–{store.prepTime + 10} min
                  </span>
                  <span className="pill">
                    <Truck size={12} />
                    {money(store.deliveryFee)} delivery
                  </span>
                  <span className="pill">Min. {money(store.minOrder)}</span>
                </div>
              </div>
              <div className="grid gap-2 text-[11px] font-bold text-ink/55">
                <div className="flex items-start gap-2">
                  <MapPin size={14} className="mt-0.5 shrink-0 text-teal" />
                  <span>
                    {store.address}
                    <br />
                    <span className="text-ink/35">{store.landmark}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock3 size={14} className="text-teal" />
                  {openState.open ? openState.detail : openState.detail}
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-teal" />
                  Cash on delivery · no card needed
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="container-wassl mt-6 grid gap-6 lg:grid-cols-[1fr_330px] lg:items-start">
          <div className="min-w-0">
            {store.isOpen ? (
              <StoreMenu store={store} products={products} />
            ) : (
              <div className="card p-8 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-cream text-ink/35">
                  <Clock3 size={24} />
                </div>
                <h2 className="mt-3 text-2xl font-extrabold tracking-tight">Closed for now</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-ink/50">
                  This store is not accepting orders at the moment. Check back later or
                  browse another store in {city.name}.
                </p>
                <Link href={`/city/${city.slug}`} className="btn btn-primary mt-5">
                  Browse {city.name}
                </Link>
              </div>
            )}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24">
            <CartMini storeId={store.id} />

            <div className="card-flat overflow-hidden">
              <MapView
                points={[
                  {
                    id: store.id,
                    lat: store.lat,
                    lng: store.lng,
                    kind: "store",
                    label: store.name,
                  },
                ]}
                center={{ lat: store.lat, lng: store.lng }}
                zoom={15}
                height={190}
                interactive={false}
              />
              <div className="p-3">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-ink/35">
                  Pickup location
                </div>
                <div className="mt-1 text-[11px] font-bold text-ink/60">{store.address}</div>
              </div>
            </div>

            {store.openingHours?.length ? (
              <div className="card-flat p-4">
                <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-ink/35">
                  <Clock3 size={12} /> Kitchen hours
                </div>
                <div className="mt-2 space-y-1">
                  {store.openingHours.map((entry) => (
                    <div
                      key={`${entry.days}-${entry.open}`}
                      className="flex items-center justify-between text-[11px] font-bold text-ink/55"
                    >
                      <span>{entry.days}</span>
                      <span className="text-ink/40">
                        {entry.open}–{entry.close}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[9px] leading-4 text-ink/35">
                  Hours are local (Africa/Casablanca). Delivery hours may differ during Ramadan.
                </p>
              </div>
            ) : null}

            <div className="rounded-2xl bg-teal/8 p-4">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-teal">
                Cash on delivery
              </div>
              <p className="mt-1 text-[11px] leading-5 text-ink/55">
                Pay the driver in cash when your order arrives. The amount is shown
                before you confirm.
              </p>
            </div>

            {store.dataOrigin === "marocapis" ? (
              <div className="rounded-2xl border border-ink/8 bg-white/50 p-4">
                <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-ink/35">
                  <Database size={12} /> About this listing
                </div>
                <p className="mt-1.5 text-[10px] leading-5 text-ink/45">
                  Establishment details and hours come from Maroc APIs and Google Maps
                  (via SerpApi), locked on{" "}
                  {store.verifiedAt
                    ? new Date(store.verifiedAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "import"}.
                  {hasRating
                    ? ` Rating: ${store.rating.toFixed(1)} from ${store.reviews.toLocaleString("en-US")} Google reviews.`
                    : ""}{" "}
                  The menu is demo content and is locked against edits.
                </p>
                {store.sourceUrl ? (
                  <a
                    href={store.sourceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-2 inline-block text-[10px] font-extrabold text-teal hover:underline"
                  >
                    View the source listing →
                  </a>
                ) : null}
              </div>
            ) : null}
          </aside>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
