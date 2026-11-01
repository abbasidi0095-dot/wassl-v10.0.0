import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Clock3,
  Heart,
  ListChecks,
  MapPin,
  PackageCheck,
  ReceiptText,
  ShoppingBag,
  ShoppingBasket,
  Star,
  UserRound,
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import { isEmailVerified } from "@/lib/email-verification";
import { getCities, getOrderViews, getUserById } from "@/lib/db";
import { storePhoto } from "@/lib/store-images";
import { STATUS_META } from "@/lib/types";
import { money, timeAgo } from "@/lib/utils";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getTranslator } from "@/lib/i18n-server";
import { SignOutButton } from "./sign-out-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your account · Wassl" };

const OPEN_STATUSES = new Set([
  "placed",
  "accepted",
  "preparing",
  "ready",
  "assigned",
  "picked_up",
  "en_route",
]);

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "W") + (parts[1]?.[0] ?? "");
}

export default async function AccountPage() {
  const session = await requireRole("customer");
  const { t } = await getTranslator();
  const [cities, user, orders] = await Promise.all([
    getCities(),
    getUserById(session.userId),
    session.email
      ? getOrderViews({ customerEmail: session.email })
      : Promise.resolve([]),
  ]);

  const sorted = [...orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const activeOrders = sorted.filter((order) => OPEN_STATUSES.has(order.status));
  const delivered = sorted.filter((order) => order.status === "delivered");
  const city = cities.find((candidate) => candidate.slug === user?.citySlug);
  const cityForHeader =
    cities.find((candidate) => candidate.slug === sorted[0]?.citySlug) ||
    cities.find((candidate) => candidate.slug === "dakhla");
  const verified = user ? isEmailVerified(user) : true;
  const firstName = session.name.split(" ")[0];

  const quickLinks = [
    {
      href: "/account/loyalty",
      label: t("Wassl Club"),
      note: t("Points, tiers and rewards"),
      icon: Star,
    },
    {
      href: "/grocery/favorites",
      label: t("Favourites"),
      note: t("Products you keep coming back to"),
      icon: Heart,
    },
    {
      href: "/grocery/lists",
      label: t("Shopping lists"),
      note: t("Plan the week, add it in one go"),
      icon: ListChecks,
    },
    {
      href: "/orders",
      label: t("Order history"),
      note: t("Deliveries, groceries and taxi rides"),
      icon: ReceiptText,
    },
    {
      href: "/grocery",
      label: t("Grocery aisles"),
      note: t("Live stock from local supermarkets"),
      icon: ShoppingBasket,
    },
  ];

  return (
    <>
      <SiteHeader cities={cities} currentCity={cityForHeader} />

      <main className="container-wassl pt-8 lg:pt-12">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <div className="eyebrow">{t("Your account")}</div>
            <h1 className="display mt-2 text-[clamp(2.4rem,1.7rem+2.6vw,4rem)]">
              {t("Salam, {name}.", { name: firstName })}
            </h1>
            <p className="mt-3 max-w-[54ch] text-[14px] leading-6 text-muted">
              {t(
                "Your orders, saved products and shopping lists — kept together so the next order takes less time.",
              )}
            </p>
          </div>
          <SignOutButton className="btn btn-ghost btn-sm" />
        </header>

        <div className="mt-8 grid items-start gap-4 pb-16 lg:grid-cols-[1.55fr_1fr]">
          <div className="space-y-4">
            <section className="aero-tile rounded-[10px] border p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-[22px] font-semibold tracking-[-0.025em]">
                    {t("Recent orders")}
                  </h2>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {activeOrders.length
                      ? t("{count} in progress right now", {
                          count: activeOrders.length,
                        })
                      : t("No orders in progress right now")}
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 text-[11px] text-muted tnum">
                  <span className="status-dot text-success" />
                  {sorted.length} {t("total")}
                </span>
              </div>

              {sorted.length ? (
                <>
                  <ul className="mt-4 divide-y divide-line border-t border-line">
                    {sorted.slice(0, 6).map((order) => {
                      const meta = STATUS_META[order.status];
                      const open = OPEN_STATUSES.has(order.status);
                      return (
                        <li key={order.id}>
                          <Link
                            href={`/orders/${order.id}`}
                            className="group flex items-center gap-3 py-3.5 transition-colors hover:bg-surface-2/60"
                          >
                            <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[6px] bg-surface-2">
                              {order.store ? (
                                <Image
                                  src={storePhoto(order.store)}
                                  alt=""
                                  fill
                                  sizes="44px"
                                  className="object-cover"
                                />
                              ) : (
                                <span className="grid h-full w-full place-items-center text-muted">
                                  <ShoppingBag size={16} />
                                </span>
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-semibold">
                                {order.store?.name || t("Store")}
                              </span>
                              <span className="mt-0.5 block text-[11px] text-muted tnum">
                                {order.code} · {timeAgo(order.createdAt)}
                              </span>
                            </span>
                            <span className="text-end">
                              <span className="block text-[13px] font-semibold tnum">
                                {money(order.total)}
                              </span>
                              <span
                                className={`mt-0.5 block text-[11px] font-medium ${
                                  order.status === "delivered"
                                    ? "text-success"
                                    : order.status === "cancelled"
                                      ? "text-danger"
                                      : open
                                        ? "text-signal"
                                        : "text-muted"
                                }`}
                              >
                                {t(meta.label)}
                              </span>
                            </span>
                            <ArrowRight
                              size={14}
                              className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100"
                            />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                    <Link
                      href="/orders"
                      className="inline-flex items-center gap-1 text-[12px] font-medium text-brand"
                    >
                      {t("View all orders")}
                      <ArrowRight size={12} className="rtl:-scale-x-100" />
                    </Link>
                    <span className="text-[11px] text-muted">
                      {delivered.length} {t("delivered")}
                    </span>
                  </div>
                </>
              ) : (
                <div className="mt-4 rounded-[8px] bg-surface-2/70 px-5 py-10 text-center">
                  <PackageCheck size={24} className="mx-auto text-brand" />
                  <p className="mt-3 font-display text-[19px] font-semibold">
                    {t("No orders yet")}
                  </p>
                  <p className="mx-auto mt-1.5 max-w-[38ch] text-[12px] leading-5 text-muted">
                    {t(
                      "Order from a local store and it will show up here on every device you sign in to.",
                    )}
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <Link href="/city/dakhla" className="btn btn-primary btn-sm">
                      {t("Browse Dakhla")}
                      <ArrowRight size={13} className="rtl:-scale-x-100" />
                    </Link>
                    <Link href="/grocery" className="btn btn-ghost btn-sm">
                      {t("Shop groceries")}
                    </Link>
                  </div>
                </div>
              )}
            </section>

            <section>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-[20px] font-semibold tracking-[-0.02em]">
                  {t("Quick access")}
                </h2>
                <span className="text-[11px] text-muted">
                  {t("Saved for your next order")}
                </span>
              </div>
              <div className="mt-3 grid gap-px overflow-hidden rounded-[10px] border border-line bg-line sm:grid-cols-2">
                {quickLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex items-start gap-3 bg-surface p-4 transition-colors hover:bg-surface-2"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[6px] bg-surface-2 text-brand transition-colors group-hover:bg-surface">
                      <item.icon size={16} strokeWidth={1.7} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2 text-[13px] font-semibold">
                        {item.label}
                        <ArrowUpRight
                          size={13}
                          className="text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 rtl:-scale-x-100"
                        />
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-4 text-muted">
                        {item.note}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24">
            <section className="aero-tile rounded-[10px] border p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[8px] bg-brand-soft font-display text-[18px] font-semibold text-brand">
                  {initials(session.name)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className="truncate text-[15px] font-semibold">
                      {session.name}
                    </div>
                    {verified ? (
                      <BadgeCheck
                        size={15}
                        className="shrink-0 text-brand"
                        aria-label={t("Verified")}
                      />
                    ) : null}
                  </div>
                  <div className="truncate text-[11px] text-muted">
                    {session.email}
                  </div>
                </div>
              </div>

              <div className="mt-5 border-t border-line pt-4">
                <div className="text-[11px] font-medium text-muted">
                  {t("Your details")}
                </div>
                <dl className="mt-3 space-y-3 text-[13px]">
                  <div className="flex items-start gap-3">
                    <MapPin size={14} className="mt-0.5 shrink-0 text-brand" />
                    <div className="min-w-0">
                      <dt className="text-[11px] text-muted">{t("City")}</dt>
                      <dd className="font-medium">{city?.name || "Dakhla"}</dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <ReceiptText size={14} className="mt-0.5 shrink-0 text-brand" />
                    <div className="min-w-0">
                      <dt className="text-[11px] text-muted">{t("Phone")}</dt>
                      <dd className="font-medium tnum">
                        {user?.phone || t("Add a phone at checkout")}
                      </dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <ShoppingBag size={14} className="mt-0.5 shrink-0 text-brand" />
                    <div className="min-w-0">
                      <dt className="text-[11px] text-muted">{t("Orders")}</dt>
                      <dd className="font-medium tnum">
                        {sorted.length} {t("placed")} · {delivered.length}{" "}
                        {t("delivered")}
                      </dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock3 size={14} className="mt-0.5 shrink-0 text-brand" />
                    <div className="min-w-0">
                      <dt className="text-[11px] text-muted">{t("Email")}</dt>
                      <dd className="flex flex-wrap items-center gap-2 font-medium">
                        <span className={verified ? "text-success" : "text-signal"}>
                          {verified ? t("Verified") : t("Not verified")}
                        </span>
                        {!verified ? (
                          <Link
                            href={`/verify-email?email=${encodeURIComponent(user?.email ?? session.email ?? "")}`}
                            className="text-[11px] font-medium text-brand underline decoration-line-strong underline-offset-2"
                          >
                            {t("Verify")}
                          </Link>
                        ) : null}
                      </dd>
                    </div>
                  </div>
                </dl>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <Link href="/" className="btn btn-primary btn-sm justify-center">
                  {t("Browse stores")}
                </Link>
                <Link href="/orders" className="btn btn-ghost btn-sm justify-center">
                  {t("Track an order")}
                </Link>
              </div>
            </section>

            <section className="aero-tile rounded-[10px] border-2/60 p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[6px] bg-surface text-brand">
                  <UserRound size={16} />
                </span>
                <div>
                  <div className="text-[13px] font-semibold">{t("Need a hand?")}</div>
                  <p className="mt-1 text-[11px] leading-5 text-muted">
                    {t(
                      "Cash is paid on arrival. If something is wrong with an order, open it and request a refund.",
                    )}
                  </p>
                  <Link
                    href="/orders"
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-brand"
                  >
                    {t("Open order history")}
                    <ArrowRight size={11} className="rtl:-scale-x-100" />
                  </Link>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
