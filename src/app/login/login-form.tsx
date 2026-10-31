"use client";

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
    <main className="grid min-h-screen bg-cream lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-ink p-10 text-on-dark lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(circle at 20% 20%, rgba(232,163,61,.55), transparent 30rem), radial-gradient(circle at 80% 80%, rgba(15,110,110,.9), transparent 34rem)",
          }}
        />
        <div className="relative">
          <Logo light />
        </div>
        <div className="relative max-w-lg">
          <span className="pill pill-warm">{t("One account, every workspace")}</span>
          <h1 className="display mt-6 text-6xl">
            {t("One platform.")}
            <br />
            {t("Every side of")}
            <br />
            {t("delivery.")}
          </h1>
          <p className="mt-5 max-w-md text-sm leading-6 text-on-dark/60">
            {t("Customers track orders, stores manage their menu, drivers run their route and operations keeps the city moving — all from the same sign-in.")}
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3">
            {[
              ["4", t("workspaces")],
              ["COD", t("cash flow")],
              ["Live", t("GPS tracking")],
            ].map(([value, label]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-2xl font-extrabold tracking-tight">{value}</div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-on-dark/40">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-[11px] text-on-dark/30">
          {t("Password sign-in · Customer, store, driver and operations accounts")}
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

          <div className="card p-6 sm:p-8">
            <div className="eyebrow">{t("Welcome back")}</div>
            <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.05em]">
              {t("Sign in")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink/55">
              {t("Use the email and password you signed up with. New customers, stores and drivers can create an account in a minute.")}
            </p>

            <form onSubmit={submit} className="mt-6 space-y-4">
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
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-ink/35 hover:text-ink"
                    aria-label={showPassword ? t("Hide password") : t("Show password")}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>

              {error ? (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
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

            <div className="mt-6 border-t border-ink/10 pt-5">
              <p className="text-xs font-bold text-ink/50">{t("New to Wassl?")}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {[
                  { href: "/signup?role=customer", label: t("Customer") },
                  { href: "/signup?role=merchant", label: t("Store owner") },
                  { href: "/signup?role=driver", label: t("Driver") },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-xl border border-ink/10 bg-white/60 px-2 py-2 text-center text-[11px] font-extrabold text-ink/60 transition hover:border-teal hover:text-teal"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-5 text-ink/40">
                {t("Store owner and driver accounts are activated after a Wassl operator approves them. Admin accounts are provisioned by operations only.")}
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between text-xs font-bold text-ink/45">
            <Link href="/" className="inline-flex items-center gap-1 hover:text-ink">
              <ArrowLeft size={14} className="rtl:-scale-x-100" /> {t("Back to storefront")}
            </Link>
            <span className="inline-flex items-center gap-1">
              <ArrowRight size={12} className="text-teal rtl:-scale-x-100" /> Wassl · {t("Southern Morocco")}
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
