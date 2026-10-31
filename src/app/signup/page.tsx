import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCities } from "@/lib/db";
import { Logo } from "@/components/logo";
import { SignupForm } from "./signup-form";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { getTranslator } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create your account · Wassl" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const [{ role }, cities, { t }] = await Promise.all([
    searchParams,
    getCities(),
    getTranslator(),
  ]);
  const initialRole =
    role === "merchant" || role === "driver" || role === "customer"
      ? role
      : "customer";

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
          <h1 className="display text-[clamp(2.8rem,1.6rem+3.4vw,4.6rem)]">
            {t("Order local.")}
            <br />
            {t("Deliver local.")}
            <br />
            {t("Grow local.")}
          </h1>
          <p className="mt-6 max-w-md text-[14px] leading-6 text-on-dark/60">
            {t("Customers order in a minute. Store owners and drivers join a vetted network — every partner account is reviewed by Wassl operations before it goes live.")}
          </p>
          <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-white/20 pt-5">
            {[
              ["209", t("cities")],
              ["COD", t("cash on delivery")],
              ["Local", t("partner network")],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="tnum font-display text-[22px] font-semibold leading-none">{value}</dt>
                <dd className="mt-1.5 text-[10px] leading-4 opacity-50">{label}</dd>
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
            <Link href="/" className="inline-flex items-center gap-1 text-xs font-bold text-ink/55">
              <ArrowLeft size={14} className="rtl:-scale-x-100" /> {t("Storefront")}
            </Link>
          </div>

          <div className="mb-4 flex items-center justify-end gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>

          <SignupForm
            initialRole={initialRole}
            cities={cities.map((city) => ({
              slug: city.slug,
              name: city.name,
              priority: city.priority,
            }))}
          />

          <div className="mt-6 flex items-center justify-between text-xs font-bold text-ink/45">
            <Link href="/" className="inline-flex items-center gap-1 hover:text-ink">
              <ArrowLeft size={14} className="rtl:-scale-x-100" /> {t("Back to storefront")}
            </Link>
            <Link href="/login" className="text-teal hover:text-teal-dark">
              {t("Already have an account?")}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
