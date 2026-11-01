import Link from "next/link";
import {
  ArrowRight,
  CarTaxiFront,
  Headphones,
  MessageCircle,
  Pill,
  ReceiptText,
  Search,
  ShoppingBasket,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { PromoTicker } from "@/components/promo-ticker";
import { StoreCard } from "@/components/store-card";
import { getSession } from "@/lib/auth";
import {
  getCities,
  getOrderViews,
  getStores,
  getTaxiRides,
  getUserById,
} from "@/lib/db";
import { getOpenState } from "@/lib/hours";
import { getPreferredCity } from "@/lib/city-preference";
import { getTranslator } from "@/lib/i18n-server";
import { money } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ORDER_ACTIVE = new Set([
  "placed",
  "accepted",
  "preparing",
  "ready",
  "assigned",
  "picked_up",
  "en_route",
]);

export default async function HomePage() {
  const { t, locale } = await getTranslator();
  const session = await getSession();
  const cities = await getCities();
  const city = await getPreferredCity(cities);
  const cityLabel = locale === "ar" ? city.nameAr : city.name;
  const stores = await getStores();
  const localStores = stores.filter((store) => store.citySlug === city.slug);
  const localPharmacies = localStores.filter(
    (store) => store.category === "pharmacy",
  );
  const pharmacyPartner = stores.find((store) => store.category === "pharmacy");
  const pharmacyPartnerCity = cities.find(
    (city) => city.slug === pharmacyPartner?.citySlug,
  );
  const [user, orders, rides] = await Promise.all([
    session ? getUserById(session.userId) : Promise.resolve(undefined),
    session?.email
      ? getOrderViews({ customerEmail: session.email })
      : Promise.resolve([]),
    session?.role === "customer"
      ? getTaxiRides({ customerId: session.userId, limit: 5 })
      : Promise.resolve([]),
  ]);
  const activeOrders = orders.filter((order) => ORDER_ACTIVE.has(order.status)).slice(0, 2);
  const activeRides = rides.filter(
    (ride) => !["completed", "cancelled"].includes(ride.status),
  ).slice(0, 1);
  const openNow = localStores.filter((store) => getOpenState(store).open).length;
  const picks = localStores
    .filter(
      (store) =>
        (store.category === "restaurant" || store.category === "cafe") &&
        getOpenState(store).open,
    )
    .sort((a, b) => b.rating - a.rating || b.reviews - a.reviews)
    .slice(0, 3);
  const name = user?.name?.split(" ")[0] || session?.name?.split(" ")[0];

  const launcher = [
    {
      href: `/city/${city.slug}`,
      label: t("Food to go"),
      note: t("Restaurants, cafés and delivery"),
      detail: t("{count} open now", { count: openNow }),
      icon: UtensilsCrossed,
    },
    {
      href: "/grocery",
      label: t("Grocery"),
      note: t("Supermarkets and essentials"),
      detail: t("Delivery or pickup"),
      icon: ShoppingBasket,
    },
    {
      href: `/pharmacy?city=${city.slug}`,
      label: t("Pharmacy"),
      note: t("Health, baby and personal care"),
      detail: localPharmacies.length
        ? localPharmacies.length === 1
          ? t("1 partner online")
          : t("{count} partners online", { count: localPharmacies.length })
        : t("Licensed partners"),
      icon: Pill,
    },
    {
      href: "/taxi",
      label: t("Taxi"),
      note: t("Cash fare, live route"),
      detail: t("Local and intercity"),
      icon: CarTaxiFront,
    },
  ];

  return (
    <>
      <SiteHeader cities={cities} currentCity={city} />
      <PromoTicker
        citySlug={city.slug}
        cityName={cityLabel}
        pharmacyLive={localPharmacies.length > 0}
        pharmacyCity={
          pharmacyPartnerCity
            ? locale === "ar"
              ? pharmacyPartnerCity.nameAr
              : pharmacyPartnerCity.name
            : ""
        }
      />
      <main className="container-wassl pb-[112px] pt-5 md:pb-12">
        <section>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-[12px] font-medium text-muted">
                {t("Now delivering in {city}", { city: cityLabel })}
              </div>
              <h1 className="display mt-1 text-[clamp(2.2rem,1.5rem+3vw,3.8rem)]">
                {name ? t("Salam, {name}.", { name }) : t("What do you need today?")}
              </h1>
              <p className="mt-2 max-w-[48ch] text-[13px] leading-6 text-muted">
                {t("One app for food, groceries, pharmacy and rides.")}
              </p>
            </div>
            <div className="hidden text-end sm:block">
              <div className="text-[11px] text-muted">{t("Open now")}</div>
              <div className="text-[20px] font-semibold tnum">{openNow}</div>
            </div>
          </div>

          <form
            action="/search"
            method="get"
            className="mt-5 flex items-center gap-2 rounded-[12px] border border-line bg-surface p-1.5 shadow-[var(--shadow)]"
            role="search"
          >
            <Search size={18} className="ms-2 shrink-0 text-muted" />
            <input
              name="q"
              placeholder={t("Search food, groceries, rides…")}
              aria-label={t("Search Wassl")}
              className="h-10 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
            />
            <input type="hidden" name="city" value={city.slug} />
            <button type="submit" className="btn btn-primary h-10 shrink-0 px-4">
              {t("Search")}
            </button>
          </form>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <Link href="/orders" className="btn btn-ghost btn-sm h-8">
              <ReceiptText size={12} /> {t("My orders")}
            </Link>
            <Link href="/messages" className="btn btn-ghost btn-sm h-8">
              <MessageCircle size={12} /> {t("Messages")}
            </Link>
            <Link href="/account/loyalty" className="btn btn-ghost btn-sm h-8">
              <Sparkles size={12} /> {t("Wassl Club")}
            </Link>
          </div>
        </section>

        {activeOrders.length || activeRides.length ? (
          <section className="mt-5">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
              {t("In progress")}
            </h2>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {activeOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="aero-tile flex items-center gap-3 rounded-[10px] border p-3"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-[6px] bg-brand-soft text-brand">
                    <ReceiptText size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-semibold">
                      {order.store?.name || t("Order")} · {order.code}
                    </span>
                    <span className="block text-[10px] text-muted">
                      {t(order.status.replace("_", " "))} · {money(order.total)}
                    </span>
                  </span>
                  <ArrowRight size={13} className="text-muted" />
                </Link>
              ))}
              {activeRides.map((ride) => (
                <Link
                  key={ride.id}
                  href={`/taxi/${ride.id}`}
                  className="aero-tile flex items-center gap-3 rounded-[10px] border p-3"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-[6px] bg-brand-soft text-brand">
                    <CarTaxiFront size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-semibold">
                      {ride.pickupLabel} → {ride.dropoffLabel}
                    </span>
                    <span className="block text-[10px] text-muted">
                      {t(ride.status)} · {money(ride.fare)}
                    </span>
                  </span>
                  <ArrowRight size={13} className="text-muted" />
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
              {t("Services")}
            </h2>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {launcher.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="aero-tile group flex min-h-[124px] flex-col justify-between rounded-[12px] border p-3.5 transition-colors hover:border-line-strong sm:min-h-[142px] lg:min-h-[132px]"
              >
                <span className="grid h-10 w-10 place-items-center rounded-[8px] bg-brand-soft text-brand">
                  <item.icon size={19} strokeWidth={1.7} />
                </span>
                <span className="mt-4 block">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-display text-[17px] font-semibold tracking-[-0.03em] min-[380px]:text-[19px]">
                      {item.label}
                    </span>
                    <ArrowRight
                      size={14}
                      className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100"
                    />
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-4 text-muted">
                    {item.note}
                  </span>
                  <span className="mt-1 block text-[9px] font-medium uppercase tracking-[0.05em] text-muted">
                    {item.detail}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        {picks.length ? (
          <section className="mt-7">
            <div>
              <h2 className="headline">{t("Open now in {city}", { city: cityLabel })}</h2>
              <p className="mt-1 text-[11px] text-muted">
                {t("Top-rated kitchens delivering today.")}
              </p>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {picks.map((store) => (
                <StoreCard key={store.id} store={store} />
              ))}
            </div>
            <Link
              href={`/city/${city.slug}`}
              className="btn btn-ghost mt-3 h-11 w-full justify-center"
            >
              {t("See all restaurants and cafés")} <ArrowRight size={13} />
            </Link>
          </section>
        ) : null}

        <footer className="mt-8 border-t border-line py-5">
          <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted">
            <span>{t("Wassl · cash on delivery · prices in MAD")}</span>
            <div className="flex flex-wrap items-center gap-4">
              <Link href="/orders" className="hover:text-ink">{t("Orders")}</Link>
              <Link href="/cities" className="hover:text-ink">{t("Cities")}</Link>
              <Link href="/messages" className="hover:text-ink">{t("Support")}</Link>
              <Link href="/account" className="hover:text-ink">{t("Account")}</Link>
              <a href="tel:+212660000000" className="inline-flex items-center gap-1 hover:text-ink">
                <Headphones size={11} /> {t("Call")}
              </a>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
