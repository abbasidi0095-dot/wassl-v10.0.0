import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCities } from "@/lib/db";
import { Logo } from "@/components/logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { getTranslator } from "@/lib/i18n-server";
import { SignupForm } from "./signup-form";

export type SignupMode = "customer" | "merchant" | "driver";

export async function SignupShell({
  mode,
  defaultKind = "delivery",
}: {
  mode: SignupMode;
  defaultKind?: "delivery" | "taxi" | "both";
}) {
  const [cities, { t }] = await Promise.all([getCities(), getTranslator()]);
  const copy =
    mode === "merchant"
      ? {
          eyebrow: t("Partner with Wassl"),
          title: t("Bring your store online."),
          intro: t(
            "Create your store account, then operations verifies your details and opens your dashboard. You keep your own menu, stock and payout view.",
          ),
        }
      : mode === "driver"
        ? {
            eyebrow: t("Drive with Wassl"),
            title: t("Work the city on your terms."),
            intro: t(
              "Apply as a delivery courier or taxi driver. Operations reviews your vehicle and documents, then unlocks your route and cash tools.",
            ),
          }
        : {
            eyebrow: t("Create an account"),
            title: t("Join Wassl."),
            intro: t(
              "Order from local stores in a minute. Save addresses, track deliveries live and keep every receipt in one place.",
            ),
          };

  return (
    <main className="grid min-h-screen bg-paper lg:grid-cols-[1.02fr_0.98fr]">
      <section className="relative hidden overflow-hidden bg-ink p-10 text-on-dark lg:flex lg:flex-col lg:justify-between">
        <Image
          src="/images/stores/grocery-1.jpg"
          alt=""
          fill
          priority
          sizes="50vw"
          className="object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-ink/60" aria-hidden="true" />
        <div className="relative">
          <Logo light />
        </div>
        <div className="relative max-w-lg">
          <p className="text-[13px] font-medium text-saffron">{copy.eyebrow}</p>
          <h1 className="display mt-3 text-[clamp(2.6rem,1.6rem+3.2vw,4.4rem)]">
            {copy.title}
          </h1>
          <p className="mt-6 max-w-md text-[14px] leading-6 text-on-dark/60">
            {copy.intro}
          </p>
          <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-white/20 pt-5">
            {[
              ["209", t("cities")],
              ["COD", t("cash on delivery")],
              ["Local", t("partner network")],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="tnum font-display text-[22px] font-semibold leading-none">{value}</dt>
                <dd className="mt-1.5 text-[11px] leading-4 opacity-50">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="relative text-[11px] text-on-dark/30">
          Dakhla · Laâyoune · Boujdour · Esmara · Tarfaya
        </p>
      </section>

      <section className="flex min-h-screen items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Logo />
            <Link href="/" className="inline-flex items-center gap-1 text-xs font-bold text-muted">
              <ArrowLeft size={14} className="rtl:-scale-x-100" /> {t("Storefront")}
            </Link>
          </div>

          <div className="mb-4 flex items-center justify-end gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>

          <SignupForm
            initialRole={mode}
            initialKind={defaultKind}
            lockedRole
            cities={cities.map((city) => ({
              slug: city.slug,
              name: city.name,
              priority: city.priority,
            }))}
          />

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-muted">
            <Link href="/" className="inline-flex items-center gap-1 hover:text-ink">
              <ArrowLeft size={14} className="rtl:-scale-x-100" /> {t("Back to storefront")}
            </Link>
            <Link href="/login" className="text-brand hover:text-brand-dark">
              {t("Already have an account?")}
            </Link>
          </div>

          <div className="mt-5 border-t border-line pt-4 text-[11px] leading-5 text-muted">
            {mode === "customer" ? (
              <>
                {t("Joining as a store or driver?")}{" "}
                <Link href="/signup/store" className="font-semibold text-brand">
                  {t("Store partner")}
                </Link>{" "}
                ·{" "}
                <Link href="/signup/driver" className="font-semibold text-brand">
                  {t("Driver partner")}
                </Link>
              </>
            ) : (
              <>
                {t("Looking to order instead?")}{" "}
                <Link href="/signup" className="font-semibold text-brand">
                  {t("Customer sign up")}
                </Link>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
