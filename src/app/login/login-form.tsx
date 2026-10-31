"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { useI18n } from "@/components/locale-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";

export function LoginForm({
  next,
  blocked,
}: {
  next?: string;
  blocked?: boolean;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(
    blocked ? "This account was not approved. Contact Wassl operations." : "",
  );
  const [loading, setLoading] = useState(false);

  const canSubmit =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && password.length > 0;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json()) as {
        error?: string;
        redirect?: string;
        role?: string;
        needsApproval?: boolean;
      };
      if (!response.ok) {
        setError(data.error || "Could not sign in");
        return;
      }
      const safeNext =
        next && /^[a-z0-9][a-z0-9/_-]*$/i.test(next) ? `/${next}` : null;
      const target = safeNext || data.redirect || "/";
      router.push(target);
      router.refresh();
    } catch {
      setError("Could not reach Wassl. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-paper lg:grid-cols-[1.02fr_0.98fr]">
      <section className="relative hidden overflow-hidden bg-ink p-10 text-on-dark lg:flex lg:flex-col lg:justify-between">
        <Image
          src="/images/stores/moroccan-2.jpg"
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

        <div className="relative max-w-[30rem]">
          <h1 className="display text-[clamp(2.8rem,1.6rem+3.4vw,4.6rem)]">
            {t("One platform.")}
            <br />
            {t("Every side of")}
            <br />
            {t("delivery.")}
          </h1>
          <p className="mt-6 max-w-md text-[14px] leading-6 opacity-60">
            {t(
              "Customers track orders, stores manage their menu, drivers run their route and operations keeps the city moving — all from the same sign-in.",
            )}
          </p>
          <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-white/20 pt-5">
            {[
              ["4", t("workspaces")],
              ["COD", t("cash flow")],
              ["Live", t("GPS tracking")],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="tnum font-display text-[22px] font-semibold leading-none">
                  {value}
                </dt>
                <dd className="mt-1.5 text-[10px] leading-4 opacity-50">{label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="relative text-[11px] opacity-40">
          {t("Customer, store, driver and operations accounts")}
        </p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[400px]">
          <div className="mb-10 flex items-center justify-between lg:hidden">
            <Logo />
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-[12px] text-muted"
            >
              <ArrowLeft size={13} className="rtl:-scale-x-100" /> {t("Storefront")}
            </Link>
          </div>

          <div className="mb-6 flex items-center justify-end gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>

          <p className="text-[12px] text-muted">{t("Welcome back")}</p>
          <h2 className="display mt-2 text-[clamp(2rem,1.6rem+1.4vw,2.7rem)]">
            {t("Sign in")}
          </h2>
          <p className="mt-3 text-[13px] leading-6 text-muted">
            {t(
              "Use the email and password you signed up with. New customers, stores and drivers can create an account in a minute.",
            )}
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <label className="block">
              <span className="label">{t("Email")}</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="input"
                placeholder="you@example.ma"
                autoComplete="email"
                autoFocus
                required
              />
            </label>

            <label className="block">
              <span className="label">{t("Password")}</span>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="input pe-11"
                  placeholder={t("Your password")}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute end-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-[4px] text-muted hover:bg-surface-2 hover:text-ink"
                  aria-label={
                    showPassword ? t("Hide password") : t("Show password")
                  }
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            {error ? (
              <p className="border-s-2 border-danger ps-3 text-[12px] leading-5 text-danger">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={!canSubmit || loading}
              className="btn btn-primary w-full disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ShieldCheck size={16} />
              )}
              {loading ? t("Signing in…") : t("Sign in")}
            </button>
          </form>

          <div className="mt-8 border-t border-line pt-5">
            <p className="text-[12px] text-muted">{t("New to Wassl?")}</p>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
              {[
                { href: "/signup?role=customer", label: t("Customer") },
                { href: "/signup?role=merchant", label: t("Store owner") },
                { href: "/signup?role=driver", label: t("Driver") },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-brand"
                >
                  {item.label}
                  <ArrowRight size={11} className="rtl:-scale-x-100" />
                </Link>
              ))}
            </div>
            <p className="mt-4 text-[11px] leading-5 text-muted">
              {t(
                "Store owner and driver accounts are activated after a Wassl operator approves them. Admin accounts are provisioned by operations only.",
              )}
            </p>
          </div>

          <div className="mt-8 flex items-center justify-between text-[11px] text-muted">
            <Link href="/" className="inline-flex items-center gap-1 hover:text-ink">
              <ArrowLeft size={12} className="rtl:-scale-x-100" /> {t("Back to storefront")}
            </Link>
            <span>Wassl · {t("Southern Morocco")}</span>
          </div>
        </div>
      </section>
    </main>
  );
}
