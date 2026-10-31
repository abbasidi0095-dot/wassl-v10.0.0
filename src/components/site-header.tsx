"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CarTaxiFront,
  ChevronDown,
  LayoutDashboard,
  MapPin,
  Menu,
  ReceiptText,
  ShoppingBag,
  ShoppingBasket,
  Store,
  UserRound,
  X,
} from "lucide-react";
import type { City } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { LanguageSwitcher } from "./language-switcher";
import { NotificationBell } from "./notification-bell";
import { ThemeToggle } from "./theme-toggle";
import { useI18n } from "./locale-provider";
import { useCart } from "./cart-provider";

type AccountInfo = {
  name: string;
  role: string;
  status?: "active" | "pending" | "rejected";
};

function accountHref(account: AccountInfo) {
  if (account.status === "pending") return "/pending";
  if (account.status === "rejected") return "/login?blocked=1";
  if (account.role === "merchant") return "/merchant";
  if (account.role === "driver") return "/driver";
  if (account.role === "admin") return "/admin";
  return "/account";
}

export function SiteHeader({
  cities,
  currentCity,
}: {
  cities: City[];
  currentCity?: City;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { count } = useCart();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState<AccountInfo | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    fetch("/api/session", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { session: null }))
      .then((data: { session?: AccountInfo | null }) => {
        if (active) setAccount(data.session ?? null);
      })
      .catch(() => {
        if (active) setAccount(null);
      });
    return () => {
      active = false;
    };
  }, [pathname]);
  const southern = cities.filter((city) => city.priority);
  const others = cities.filter((city) => !city.priority);
  const selected = currentCity?.slug || "dakhla";

  const nav = [
    { href: currentCity ? `/city/${currentCity.slug}` : "/", label: t("Discover") },
    { href: "/grocery", label: t("Grocery") },
    { href: "/taxi", label: t("Taxi") },
    { href: "/orders", label: t("My orders") },
    { href: "/login?next=merchant", label: t("For business") },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-ink/5 bg-cream/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="container-wassl flex h-[68px] items-center justify-between gap-3">
          <Logo />

          <nav className="hidden items-center gap-1 lg:flex">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-xl px-3 py-2 text-[13px] font-bold text-ink/65 transition hover:bg-white/60 hover:text-ink",
                  pathname === item.href && "bg-white/75 text-ink shadow-sm",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <label className="relative hidden sm:block">
              <MapPin
                size={15}
                className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-teal"
              />
              <select
                value={selected}
                onChange={(event) => {
                  router.push(`/city/${event.target.value}`);
                  setOpen(false);
                }}
                className="h-10 max-w-[185px] appearance-none rounded-xl border border-ink/10 bg-white/70 ps-8 pe-8 text-xs font-extrabold text-ink outline-none transition hover:bg-white focus:border-teal"
                aria-label={t("Choose city")}
              >
                <optgroup label={t("Southern Morocco")}>
                  {southern.map((city) => (
                    <option key={city.slug} value={city.slug}>
                      {city.name} — {city.nameAr}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={t("All Morocco")}>
                  {others.map((city) => (
                    <option key={city.slug} value={city.slug}>
                      {city.name}
                    </option>
                  ))}
                </optgroup>
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-ink/40"
              />
            </label>

            <div className="hidden md:block">
              <LanguageSwitcher />
            </div>
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>

            <NotificationBell />

            <Link
              href="/cart"
              className="relative grid h-10 w-10 place-items-center rounded-xl border border-ink/10 bg-white/70 text-ink transition hover:bg-white"
              aria-label={t("Cart")}
            >
              <ShoppingBag size={18} />
              {count > 0 ? (
                <span className="absolute -end-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-coral px-1 text-[10px] font-extrabold text-on-dark">
                  {count}
                </span>
              ) : null}
            </Link>

            <Link
              href={account ? accountHref(account) : "/login"}
              className="hidden h-10 items-center gap-2 rounded-xl bg-ink px-3.5 text-xs font-extrabold text-on-dark transition hover:bg-teal-dark sm:flex"
            >
              {account?.role === "customer" ? (
                <UserRound size={15} />
              ) : (
                <LayoutDashboard size={15} />
              )}
              {account
                ? account.status === "pending"
                  ? t("Pending review")
                  : account.role === "customer"
                    ? t("Account")
                    : t("Dashboard")
                : t("Sign in")}
            </Link>

            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="grid h-10 w-10 place-items-center rounded-xl border border-ink/10 bg-white/70 lg:hidden"
              aria-label={t("Menu")}
            >
              {open ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </div>

        {open ? (
          <div className="container-wassl pb-4 lg:hidden">
            <div className="card-flat grid gap-1 p-2">
              <label className="relative mb-1 sm:hidden">
                <MapPin
                  size={15}
                  className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-teal"
                />
                <select
                  value={selected}
                  onChange={(event) => {
                    router.push(`/city/${event.target.value}`);
                    setOpen(false);
                  }}
                  className="input appearance-none ps-9"
                  aria-label={t("Choose city")}
                >
                  <optgroup label={t("Southern Morocco")}>
                    {southern.map((city) => (
                      <option key={city.slug} value={city.slug}>
                        {city.name} — {city.nameAr}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label={t("All Morocco")}>
                    {others.map((city) => (
                      <option key={city.slug} value={city.slug}>
                        {city.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </label>
              <div className="mb-1 flex items-center gap-2 px-1">
                <LanguageSwitcher />
                <ThemeToggle />
              </div>
              {[
                { href: "/", label: t("Home"), icon: MapPin },
                { href: "/grocery", label: t("Grocery"), icon: ShoppingBasket },
                { href: "/taxi", label: t("Taxi"), icon: CarTaxiFront },
                { href: "/orders", label: t("My orders"), icon: ReceiptText },
                ...(account
                  ? [
                      {
                        href: accountHref(account),
                        label:
                          account.status === "pending"
                            ? t("Pending review")
                            : account.role === "customer"
                              ? t("My account")
                              : t("Dashboard"),
                        icon: UserRound,
                      },
                    ]
                  : [
                      { href: "/login", label: t("Sign in"), icon: UserRound },
                      { href: "/signup", label: t("Create account"), icon: UserRound },
                    ]),
                { href: "/login?next=merchant", label: t("Sell on Wassl"), icon: Store },
                { href: "/login?next=admin", label: t("Admin"), icon: LayoutDashboard },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold hover:bg-cream"
                >
                  <item.icon size={16} className="text-teal" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-cream/95 px-2 pb-[max(6px,env(safe-area-inset-bottom))] ps-[max(0.5rem,env(safe-area-inset-left))] pe-[max(0.5rem,env(safe-area-inset-right))] pt-1.5 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-md items-center justify-around">
          {[
            { href: "/", label: t("Home"), icon: MapPin },
            { href: currentCity ? `/city/${currentCity.slug}` : "/", label: t("Stores"), icon: Store },
            { href: "/grocery", label: t("Grocery"), icon: ShoppingBasket },
            { href: "/taxi", label: t("Taxi"), icon: CarTaxiFront },
            { href: "/orders", label: t("Orders"), icon: ReceiptText },
            {
              href: account ? accountHref(account) : "/login",
              label: account
                ? account.status === "pending"
                  ? t("Pending")
                  : t("Account")
                : t("Sign in"),
              icon: UserRound,
            },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "relative flex min-w-[48px] flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[8px] font-extrabold text-ink/55",
                pathname === item.href && "bg-white text-teal shadow-sm",
              )}
            >
              <item.icon size={17} />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
