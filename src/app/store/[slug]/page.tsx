import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Clock3,
  Database,
  MapPin,
  ShieldCheck,
  Star,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { StoreMenu } from "@/components/store-menu";
import { CartMini } from "@/components/cart-mini";
import { MapView } from "@/components/map-view";
import { GroceryStore } from "@/components/grocery-store";
import {
  getCities,
  getCity,
  getDrivers,
  getProducts,
  getStore,
  getUserById,
} from "@/lib/db";
import { getSession } from "@/lib/auth";
import { groceryAvailability, grocerySettings } from "@/lib/grocery";
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
  const city = await getCity(store.citySlug);
  if (!city) notFound();
  const products = await getProducts(store.id);
  const cities = await getCities();

  if (store.category === "grocery") {
    const [drivers, session] = await Promise.all([
      getDrivers(store.citySlug),
      getSession(),
    ]);
    const user = session ? await getUserById(session.userId) : undefined;
    const settings = grocerySettings(store);
    const availability = groceryAvailability(
      store,
      drivers.filter((driver) => driver.active).length,
    );
    return (
      <>
        <SiteHeader cities={cities} currentCity={city} />
        <main className="container-wassl py-6">
          <GroceryStore
            store={store}
            photo={storePhoto(store)}
            products={products}
            settings={settings}
            availability={availability}
            loyaltyPoints={user?.loyaltyPoints ?? 0}
            favorites={user?.favorites ?? []}
            signedIn={Boolean(session)}
          />
        </main>
        <SiteFooter />
      </>
    );
  }

  const openState = getOpenState(store);
  const hasRating = store.rating > 0 && store.reviews > 0;
  const tags = [...new Set([...(store.dietaryTags ?? []), ...(store.tags ?? [])])];

  return (
    <>
      <SiteHeader cities={cities} currentCity={city} />
      <main>
        <div className="container-wassl">
          <div className="grid gap-6 border-b border-line pb-7 pt-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:gap-10">
            <div>
              <nav
                className="flex items-center gap-2 text-[11px] text-muted"
                aria-label="Breadcrumb"
              >
                <Link
                  href={`/city/${city.slug}`}
                  className="inline-flex items-center gap-1 hover:text-ink"
                >
                  <ArrowLeft size={12} className="rtl:-scale-x-100" /> {city.name}
                </Link>
                <span className="text-line-strong">/</span>
                <span className="text-ink">{store.name}</span>
              </nav>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className={`status-dot ${openState.open ? "live-dot" : ""} ${
                      openState.open ? "text-success" : "text-danger"
                    }`}
                  />
                  {openState.open ? "Open now" : openState.label}
                </span>
                <span className="text-line-strong">/</span>
                <span>{categoryLabel(store.category)}</span>
                <span className="text-line-strong">/</span>
                <span>{city.name}</span>
                {store.priceLevel ? (
                  <>
                    <span className="text-line-strong">/</span>
                    <span>{PRICE_LABEL[store.priceLevel]}</span>
                  </>
                ) : null}
                {hasRating ? (
                  <>
                    <span className="text-line-strong">/</span>
                    <span className="inline-flex items-center gap-1 tnum">
                      <Star size={10} className="fill-signal text-signal" />
                      {store.rating.toFixed(1)} · {store.reviews} reviews
                    </span>
                  </>
                ) : null}
              </div>

              <h1 className="display mt-4 text-[clamp(2.4rem,1.6rem+3vw,4.2rem)]">
                {store.name}
              </h1>
              {store.nameAr ? (
                <p className="arabic mt-1.5 text-[15px] text-muted">{store.nameAr}</p>
              ) : null}
              <p className="mt-3 max-w-[52ch] text-[14px] leading-6 text-muted" dir="auto">
                {store.description}
              </p>

              <dl className="mt-5 flex flex-wrap gap-x-7 gap-y-2 text-[13px]">
                <div>
                  <dt className="inline text-muted">Delivery </dt>
                  <dd className="inline font-medium tnum">
                    {money(store.deliveryFee)}
                  </dd>
                </div>
                <div>
                  <dt className="inline text-muted">Ready in </dt>
                  <dd className="inline font-medium tnum">
                    {store.prepTime}–{store.prepTime + 10} min
                  </dd>
                </div>
                <div>
                  <dt className="inline text-muted">Minimum </dt>
                  <dd className="inline font-medium tnum">{money(store.minOrder)}</dd>
                </div>
                <div>
                  <dt className="inline text-muted">Payment </dt>
                  <dd className="inline font-medium">Cash on delivery</dd>
                </div>
              </dl>

              {tags.length ? (
                <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
                  {tags.slice(0, 5).map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="relative order-first aspect-[16/10] overflow-hidden rounded-[10px] bg-surface-2 lg:order-none lg:aspect-[16/11]">
              <Image
                src={storePhoto(store)}
                alt={`${store.name} storefront`}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 42vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>

        <section className="container-wassl mt-6 grid gap-8 lg:grid-cols-[1fr_300px] lg:items-start">
          <div className="min-w-0">
            {store.isOpen ? (
              <StoreMenu store={store} products={products} />
            ) : (
              <div className="border-y border-line py-16 text-center">
                <Clock3 size={22} className="mx-auto text-muted" />
                <h2 className="mt-3 font-display text-xl font-semibold">
                  Closed for now
                </h2>
                <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-6 text-muted">
                  This store is not accepting orders at the moment. Check back later
                  or browse another store in {city.name}.
                </p>
                <Link href={`/city/${city.slug}`} className="btn btn-primary mt-5">
                  Browse {city.name}
                </Link>
              </div>
            )}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24">
            <CartMini storeId={store.id} />

            <div className="overflow-hidden aero-tile rounded-[10px] border">
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
                height={170}
                interactive={false}
                className="rounded-none"
              />
              <div className="border-t border-line p-3.5">
                <div className="text-[11px] text-muted">Pickup location</div>
                <div className="mt-1 text-[13px] font-medium">{store.address}</div>
                <div className="text-[11px] text-muted">{store.landmark}</div>
              </div>
            </div>

            {store.openingHours?.length ? (
              <div className="aero-tile rounded-[10px] border p-4">
                <div className="flex items-center gap-1.5 text-[11px] text-muted">
                  <Clock3 size={12} /> Kitchen hours
                </div>
                <div className="mt-2.5 space-y-1.5">
                  {store.openingHours.map((entry) => (
                    <div
                      key={`${entry.days}-${entry.open}`}
                      className="flex items-center justify-between text-[13px]"
                    >
                      <span className="text-muted">{entry.days}</span>
                      <span className="tnum">
                        {entry.open}–{entry.close}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-2.5 text-[11px] leading-4 text-muted">
                  Hours are local (Africa/Casablanca). Delivery hours may differ during
                  Ramadan.
                </p>
              </div>
            ) : null}

            <div className="border-s-2 border-brand ps-3.5">
              <div className="flex items-center gap-1.5 text-[13px] font-medium">
                <ShieldCheck size={13} className="text-brand" /> Cash on delivery
              </div>
              <p className="mt-1 text-[11px] leading-5 text-muted">
                Pay the driver in cash when your order arrives. The amount is shown
                before you confirm.
              </p>
            </div>

            {store.dataOrigin === "marocapis" ? (
              <div className="border-t border-line pt-3.5">
                <div className="flex items-center gap-1.5 text-[11px] text-muted">
                  <Database size={12} /> About this listing
                </div>
                <p className="mt-1.5 text-[11px] leading-4 text-muted">
                  Establishment details and hours come from Maroc APIs and Google Maps
                  (via SerpApi), locked on{" "}
                  {store.verifiedAt
                    ? new Date(store.verifiedAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "import"}
                  .{hasRating
                    ? ` Rating: ${store.rating.toFixed(1)} from ${store.reviews} Google reviews.`
                    : ""}{" "}
                  The menu is demo content and is locked against edits.
                </p>
                {store.sourceUrl ? (
                  <a
                    href={store.sourceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-brand"
                  >
                    <MapPin size={11} /> View the source listing
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
