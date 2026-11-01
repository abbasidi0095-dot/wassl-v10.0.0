"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CarTaxiFront,
  ChevronDown,
  House,
  LayoutDashboard,
  MapPin,
  Menu,
  Package,
  ReceiptText,
  Search,
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
import { cityServices } from "@/lib/city-services";

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

const iconButton =
  "grid h-9 w-9 place-items-center rounded-[6px] text-ink/70 transition-colors hover:bg-surface-2 hover:text-ink";

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

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const southern = cities.filter((city) => city.priority);
  const others = cities.filter((city) => !city.priority);
  const selected = currentCity?.slug || "dakhla";
  const services = currentCity
    ? cityServices(currentCity)
    : {
        restaurant: true,
        grocery: true,
        taxi: true,
        express: false,
        services: false,
        business: false,
      };

  const nav = [
    {
      href: currentCity ? `/city/${currentCity.slug}` : "/",
      label: t("Discover"),
      active: pathname.startsWith("/city/"),
    },
    { href: `/search?city=${selected}`, label: t("Search"), active: pathname.startsWith("/search") },
    ...(services.grocery
      ? [{ href: "/grocery", label: t("Grocery"), active: pathname === "/grocery" }]
      : []),
    ...(services.taxi
      ? [{ href: "/taxi", label: t("Taxi"), active: pathname.startsWith("/taxi") }]
      : []),
    ...(services.express
      ? [{ href: "/express", label: t("Express"), active: pathname.startsWith("/express") }]
      : []),
    {
      href: "/orders",
      label: t("My orders"),
      active: pathname.startsWith("/orders"),
    },
    {
      href: "/signup/store",
      label: t("For business"),
      active: false,
    },
  ];

  const cityOptions = (
    <>
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
    </>
  );

  const mobileNav = [
    { href: "/", label: t("Home"), icon: House },
    ...(services.grocery
      ? [{ href: "/grocery", label: t("Grocery"), icon: ShoppingBasket }]
      : []),
    ...(services.taxi
      ? [{ href: "/taxi", label: t("Taxi"), icon: CarTaxiFront }]
      : []),
    ...(services.express
      ? [{ href: "/express", label: t("Express"), icon: Package }]
      : []),
    { href: "/orders", label: t("Orders"), icon: ReceiptText },
    {
      href: account ? accountHref(account) : "/login",
      label: account
        ? account.status === "pending"
          ? t("Pending")
          : t("Account")
        : t("Account"),
      icon: UserRound,
    },
  ];

  return (
    <>
      <header className="site-header relative z-40 border-b border-line pt-[env(safe-area-inset-top)] lg:sticky lg:top-0">
        <div className="container-wassl flex h-16 items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-7">
            <Logo responsive />
            <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  data-active={item.active}
                  className={cn(
                    "relative px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:text-ink",
                    "after:absolute after:inset-x-3 after:bottom-0 after:h-[2px] after:bg-transparent",
                    item.active && "text-ink after:bg-brand",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-1.5">
            <label className="relative hidden sm:block">
              <MapPin
                size={14}
                className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-muted"
              />
              <select
                value={selected}
                onChange={(event) => router.push(`/city/${event.target.value}`)}
                className="h-9 max-w-[190px] appearance-none rounded-[6px] border border-line bg-transparent ps-8 pe-7 text-[13px] font-medium text-ink outline-none transition-colors hover:border-line-strong focus:border-brand"
                aria-label={t("Choose city")}
              >
                {cityOptions}
              </select>
              <ChevronDown
                size={13}
                className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-muted"
              />
            </label>

            <Link
              href={`/search?city=${selected}`}
              className={cn(iconButton, "relative")}
              aria-label={t("Search Wassl")}
            >
              <Search size={18} />
            </Link>

            <LanguageSwitcher compact className="md:hidden" />
            <div className="hidden md:block">
              <LanguageSwitcher />
            </div>
            <ThemeToggle />

            <NotificationBell />

            <Link
              href="/cart"
              className={cn("relative", iconButton)}
              aria-label={t("Cart")}
            >
              <ShoppingBag size={18} />
              {count > 0 ? (
                <span className="absolute -end-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-signal px-1 text-[11px] font-semibold text-[#fffaf1] tnum">
                  {count}
                </span>
              ) : null}
            </Link>

            <Link
              href={account ? accountHref(account) : "/login"}
              className="hidden h-9 items-center gap-2 rounded-[6px] bg-ink px-3 text-[13px] font-semibold text-on-dark transition-colors hover:bg-brand sm:flex"
            >
              {account?.role === "customer" ? (
                <UserRound size={14} />
              ) : (
                <LayoutDashboard size={14} />
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
              className={cn(iconButton, "lg:hidden")}
              aria-label={t("Menu")}
              aria-expanded={open}
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {open ? (
          <div className="border-t border-line bg-surface lg:hidden">
            <div className="container-wassl grid gap-1 py-3">
              <label className="relative mb-2">
                <MapPin
                  size={15}
                  className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted"
                />
                <select
                  value={selected}
                  onChange={(event) =>
                    router.push(`/city/${event.target.value}`)
                  }
                  className="input appearance-none ps-9"
                  aria-label={t("Choose city")}
                >
                  {cityOptions}
                </select>
              </label>
              {[
                { href: "/", label: t("Home"), icon: House },
                { href: `/search?city=${selected}`, label: t("Search"), icon: Search },
                {
                  href: currentCity ? `/city/${currentCity.slug}` : "/",
                  label: t("Stores"),
                  icon: Store,
                },
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
                      {
                        href: "/signup",
                        label: t("Create account"),
                        icon: UserRound,
                      },
                    ]),
                {
                  href: "/signup/store",
                  label: t("Sell on Wassl"),
                  icon: Store,
                },
              ].map((item) => (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-[6px] px-3 py-2.5 text-sm font-medium hover:bg-surface-2"
                >
                  <item.icon size={16} className="text-muted" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </header>

      <nav
        className="tabbar fixed inset-x-2.5 bottom-[calc(8px+env(safe-area-inset-bottom))] z-40 grid overflow-hidden rounded-[18px] border border-line/80 md:hidden"
        style={{ gridTemplateColumns: `repeat(${mobileNav.length}, minmax(0, 1fr))` }}
        aria-label="Sections"
      >
        {mobileNav.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            data-active={
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`)
            }
          >
            <item.icon size={17} strokeWidth={1.75} />
            <span className="truncate">{item.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
