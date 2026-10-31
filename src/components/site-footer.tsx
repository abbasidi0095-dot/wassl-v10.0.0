"use client";

import Link from "next/link";
import { MapPin, Phone, ShieldCheck } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { Logo } from "./logo";
import { useI18n } from "./locale-provider";

export function SiteFooter() {
  const { t, locale } = useI18n();
  return (
    <footer className="mt-16 border-t border-ink/10 bg-ink text-on-dark/75">
      <div className="container-wassl grid gap-8 py-12 md:grid-cols-[1.2fr_0.8fr_0.8fr_1fr]">
        <div>
          <Logo light />
          <p className="mt-4 max-w-xs text-sm leading-6 text-on-dark/55">
            {t(
              "Local stores, local drivers, one simple way to get what you need across Southern Morocco.",
            )}
          </p>
          <p className="arabic mt-2 text-sm font-semibold text-saffron/80">
            {BRAND.taglineAr}
          </p>
          <div className="mt-5 flex items-center gap-2 text-xs font-bold text-on-dark/50">
            <ShieldCheck size={15} className="text-saffron" />
            {t("Cash on delivery · Verified partners")}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-on-dark/40">
            {t("Southern Morocco")}
          </p>
          <div className="mt-3 grid gap-2 text-sm">
            {["Dakhla", "Laayoune", "Boujdour", "Esmara", "Tarfaya"].map((city) => (
              <Link
                key={city}
                href={`/city/${city.toLowerCase().replace("â", "a")}`}
                className="inline-flex items-center gap-1.5 text-on-dark/65 hover:text-on-dark"
              >
                <MapPin size={12} className="text-saffron" />
                {city}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-on-dark/40">
            {t("Platform")}
          </p>
          <div className="mt-3 grid gap-2 text-sm text-on-dark/65">
            <Link href="/login?next=merchant">{t("Store dashboard")}</Link>
            <Link href="/login?next=driver">{t("Driver app")}</Link>
            <Link href="/login?next=admin">{t("Admin console")}</Link>
            <Link href="/cart">{t("Your cart")}</Link>
          </div>
        </div>

        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-on-dark/40">
            {t("Support")}
          </p>
          <a
            href={`tel:${BRAND.supportPhone.replace(/\s/g, "")}`}
            className="mt-3 flex items-center gap-2 text-sm font-bold text-on-dark"
          >
            <Phone size={15} className="text-saffron" />
            {BRAND.supportPhone}
          </a>
          <p className="mt-2 text-xs leading-5 text-on-dark/45">
            {t("Daily 09:00–23:00")}
            <br />
            {t("Arabic · Français · English")}
          </p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-wassl flex flex-col gap-2 py-5 text-[11px] text-on-dark/35 sm:flex-row sm:items-center sm:justify-between">
          <span>
            {t("© {year} {brand}. Built for Morocco.", {
              year: new Date().getFullYear(),
              brand: BRAND.name,
            })}
          </span>
          <span>{t("Demo environment · COD only · Prices in MAD")}</span>
        </div>
      </div>
    </footer>
  );
}
