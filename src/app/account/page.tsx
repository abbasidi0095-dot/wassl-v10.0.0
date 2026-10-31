import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Clock3,
  MapPin,
  PackageCheck,
  ReceiptText,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getCities, getOrderViews, getUserById } from "@/lib/db";
import { storePhoto } from "@/lib/store-images";
import { STATUS_META } from "@/lib/types";
import { money, timeAgo } from "@/lib/utils";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
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

export default async function AccountPage() {
  const session = await requireRole("customer");
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

  return (
    <>
      <SiteHeader cities={cities} currentCity={cityForHeader} />

      <main className="container-wassl pt-8 lg:pt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <div className="eyebrow">Your account</div>
            <h1 className="display mt-2 text-5xl">
              Salam, {session.name.split(" ")[0]}.
            </h1>
            <p className="mt-3 text-sm leading-6 text-ink/50">
              Your profile, your orders and the addresses you use most.
            </p>
          </div>
          <SignOutButton className="btn btn-ghost" />
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_1.6fr]">
          <section className="card p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-teal/10 text-teal">
                <UserRound size={22} />
              </div>
              <div>
                <div className="text-base font-extrabold">{session.name}</div>
                <div className="text-xs text-ink/45">{session.email}</div>
              </div>
            </div>

            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <ReceiptText size={16} className="mt-0.5 text-teal" />
                <div>
                  <dt className="text-[11px] font-medium text-ink/35">
                    Phone
                  </dt>
                  <dd className="font-semibold text-ink/75">
                    {user?.phone || "Add a phone at checkout"}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin size={16} className="mt-0.5 text-teal" />
                <div>
                  <dt className="text-[11px] font-medium text-ink/35">
                    City
                  </dt>
                  <dd className="font-semibold text-ink/75">
                    {city?.name || "Dakhla"}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ShoppingBag size={16} className="mt-0.5 text-teal" />
                <div>
                  <dt className="text-[11px] font-medium text-ink/35">
                    Orders
                  </dt>
                  <dd className="font-semibold text-ink/75">
                    {sorted.length} placed · {delivered.length} delivered
                  </dd>
                </div>
              </div>
            </dl>

            <div className="mt-6 grid grid-cols-2 gap-2">
              <Link href="/" className="btn btn-primary btn-sm justify-center">
                Browse stores
              </Link>
              <Link href="/orders" className="btn btn-ghost btn-sm justify-center">
                Track an order
              </Link>
            </div>
          </section>

          <section className="rounded-[10px] border border-line bg-surface p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-[20px] font-semibold tracking-[-0.02em]">
                  Recent orders
                </h2>
                <p className="text-[11px] text-muted">
                  {activeOrders.length
                    ? `${activeOrders.length} order${activeOrders.length > 1 ? "s" : ""} in progress`
                    : "No orders in progress right now"}
                </p>
              </div>
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-cream text-ink/45">
                <Clock3 size={16} />
              </span>
            </div>

            {sorted.length ? (
              <ul className="mt-4 divide-y divide-ink/5">
                {sorted.slice(0, 8).map((order) => {
                  const meta = STATUS_META[order.status];
                  return (
                    <li key={order.id}>
                      <Link
                        href={`/orders/${order.id}`}
                        className="flex items-center gap-3 py-3 transition hover:opacity-80"
                      >
                        <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-cream">
                          {order.store ? (
                            <Image
                              src={storePhoto(order.store)}
                              alt=""
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          ) : (
                            <span className="grid h-full w-full place-items-center text-ink/35">
                              <ShoppingBag size={15} />
                            </span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-extrabold">
                            {order.store?.name || "Store"}
                          </span>
                          <span className="block text-[10px] text-ink/40">
                            {order.code} · {timeAgo(order.createdAt)}
                          </span>
                        </span>
                        <span className="text-end">
                          <span className="block text-sm font-extrabold">
                            {money(order.total)}
                          </span>
                          <span
                            className={`mt-0.5 block text-[9px] font-extrabold uppercase ${
                              order.status === "delivered"
                                ? "text-teal"
                                : order.status === "cancelled"
                                  ? "text-red-500"
                                  : "text-saffron-deep"
                            }`}
                          >
                            {meta.label}
                          </span>
                        </span>
                        <ArrowRight size={14} className="shrink-0 text-ink/25" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="mt-6 rounded-2xl bg-cream p-6 text-center">
                <PackageCheck size={26} className="mx-auto text-teal" />
                <p className="mt-2 text-sm font-extrabold">No orders yet</p>
                <p className="mt-1 text-xs leading-5 text-ink/45">
                  Order from a local store and it will show up here on every
                  device you sign in to.
                </p>
                <Link href="/" className="btn btn-primary btn-sm mt-4 inline-flex">
                  Find something nearby
                </Link>
              </div>
            )}

            {sorted.length > 8 ? (
              <Link
                href="/orders"
                className="mt-3 inline-flex items-center gap-1 text-xs font-extrabold text-teal"
              >
                View all orders <ArrowRight size={13} />
              </Link>
            ) : null}
          </section>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
