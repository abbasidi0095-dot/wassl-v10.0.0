"use client";

import Link from "next/link";
import { ArrowUpRight, MapPin, Phone } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { Logo } from "./logo";
import { useBrand } from "./brand-provider";
import { useI18n } from "./locale-provider";

const CITIES = ["Dakhla", "Laayoune", "Boujdour", "Esmara", "Tarfaya"];

export function SiteFooter() {
  const { t } = useI18n();
  const { brandName, supportPhone } = useBrand();
  return (
    <footer className="field-ink mt-20 border-t border-line pb-[calc(86px+env(safe-area-inset-bottom))] md:pb-0">
      <div className="container-wassl">
        <div className="grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo light />
            <p className="mt-5 max-w-xs text-[15px] leading-6 opacity-60">
              {t(
                "Local stores, local drivers, one simple way to get what you need across Southern Morocco.",
              )}
            </p>
            <p className="arabic mt-3 text-[15px] font-medium text-saffron">
              {BRAND.taglineAr}
            </p>
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-[13px] opacity-50">
              <span>{t("Cash on delivery")}</span>
              <span>{t("Verified partners")}</span>
              <span>{t("Prices in MAD")}</span>
            </div>
          </div>

          <div>
            <p className="text-[13px] font-semibold opacity-40">
              {t("Southern Morocco")}
            </p>
            <div className="mt-4 grid gap-2.5 text-sm">
              {CITIES.map((city) => (
                <Link
                  key={city}
                  href={`/city/${city.toLowerCase().replace("â", "a")}`}
                  className="inline-flex w-fit items-center gap-1.5 opacity-70 transition-opacity hover:opacity-100"
                >
                  <MapPin size={12} className="opacity-50" />
                  {city}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[13px] font-semibold opacity-40">
              {t("Platform")}
            </p>
            <div className="mt-4 grid gap-2.5 text-sm opacity-70">
              <Link href="/grocery" className="hover:opacity-100">
                {t("Grocery")}
              </Link>
              <Link href="/taxi" className="hover:opacity-100">
                {t("Wassl Taxi")}
              </Link>
              <Link href="/login?next=merchant" className="hover:opacity-100">
                {t("Store dashboard")}
              </Link>
              <Link href="/login?next=driver" className="hover:opacity-100">
                {t("Driver app")}
              </Link>
            </div>
          </div>

          <div>
            <p className="text-[13px] font-semibold opacity-40">
              {t("Support")}
            </p>
            <a
              href={`tel:${supportPhone.replace(/\s/g, "")}`}
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium"
            >
              <Phone size={14} className="opacity-50" />
              {supportPhone}
            </a>
            <p className="mt-3 text-[13px] leading-5 opacity-45">
              {t("Daily 09:00–23:00")}
              <br />
              {t("Arabic · Français · English")}
            </p>
            <Link
              href="/login?next=merchant"
              className="mt-6 inline-flex items-center gap-1 text-[13px] font-medium text-saffron"
            >
              {t("Sell on Wassl")}
              <ArrowUpRight size={13} className="rtl:-scale-x-100" />
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-white/10 py-6 text-[13px] opacity-40 sm:flex-row sm:items-center sm:justify-between">
          <span>
            {t("© {year} {brand}. Built for Morocco.", {
              year: new Date().getFullYear(),
              brand: brandName,
            })}
          </span>
          <span>{t("Cash on delivery · Prices in MAD")}</span>
        </div>
      </div>
    </footer>
  );
}
