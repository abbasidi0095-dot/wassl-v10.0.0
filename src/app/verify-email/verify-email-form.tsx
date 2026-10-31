"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Loader2, Mail, RotateCcw } from "lucide-react";
import { Logo } from "@/components/logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { useI18n } from "@/components/locale-provider";

const LENGTH = 6;

export function VerifyEmailForm({
  email,
  maskedEmail,
  context,
  startWarning,
  initialCooldown,
}: {
  email: string;
  maskedEmail: string;
  context: "signup" | "login";
  startWarning: boolean;
  initialCooldown: number;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(
    startWarning
      ? t("We could not send the code. Use resend below.")
      : initialCooldown > 0
        ? t("A code was sent recently. Enter the newest code you received.")
        : "",
  );
  const [seconds, setSeconds] = useState(
    startWarning ? 0 : Math.max(initialCooldown, 0),
  );
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const submitting = useRef(false);
  const code = digits.join("");

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);

  function focus(index: number) {
    const bounded = Math.max(0, Math.min(LENGTH - 1, index));
    inputs.current[bounded]?.focus();
    inputs.current[bounded]?.select();
  }

  function write(next: string[], from = 0) {
    setDigits(next);
    const nextEmpty = next.findIndex((digit, index) => index >= from && !digit);
    focus(nextEmpty === -1 ? LENGTH - 1 : nextEmpty);
  }

  function setDigit(index: number, raw: string) {
    const clean = raw.replace(/\D/g, "");
    setError("");
    if (!clean) {
      const next = [...digits];
      next[index] = "";
      setDigits(next);
      return;
    }
    if (clean.length > 1) {
      const next = [...digits];
      clean
        .slice(0, LENGTH - index)
        .split("")
        .forEach((digit, offset) => {
          next[index + offset] = digit;
        });
      write(next, index);
      return;
    }
    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    if (index < LENGTH - 1) focus(index + 1);
  }

  function onKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();
      const next = [...digits];
      next[index - 1] = "";
      setDigits(next);
      focus(index - 1);
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      focus(index - 1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focus(index + 1);
    }
  }

  function onPaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasted) return;
    event.preventDefault();
    const next = Array(LENGTH).fill("");
    pasted
      .slice(0, LENGTH)
      .split("")
      .forEach((digit, index) => {
        next[index] = digit;
      });
    setDigits(next);
    setError("");
    focus(Math.min(pasted.length, LENGTH) - 1);
  }

  async function verify(value: string) {
    if (value.length !== LENGTH || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/verify/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: value }),
      });
      const data = (await response.json()) as {
        error?: string;
        redirect?: string;
      };
      if (!response.ok) {
        setError(data.error || t("That code is not correct. Try again."));
        setDigits(Array(LENGTH).fill(""));
        focus(0);
        return;
      }
      setNotice(t("Email verified. Opening your account…"));
      router.push(data.redirect || "/account");
      router.refresh();
    } catch {
      setError(t("Could not reach Wassl. Check your connection and try again."));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    if (code.length === LENGTH && !submitting.current) {
      void verify(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function resend() {
    if (busy || seconds > 0) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/verify/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await response.json()) as {
        error?: string;
        retryAfterSeconds?: number;
      };
      if (!response.ok) {
        setError(data.error || t("We could not send the code. Try resending in a moment."));
        setSeconds(data.retryAfterSeconds ?? 30);
        return;
      }
      setNotice(t("A new code is on its way."));
      setDigits(Array(LENGTH).fill(""));
      setSeconds(60);
      focus(0);
    } catch {
      setError(t("Could not reach Wassl. Check your connection and try again."));
    } finally {
      setBusy(false);
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
            {t("One code.")}
            <br />
            {t("One verified")}
            <br />
            {t("account.")}
          </h1>
          <p className="mt-6 max-w-md text-[14px] leading-6 opacity-60">
            {t(
              "We verify every email so order updates, receipts and account recovery reach the right person — not just anyone who knows the password.",
            )}
          </p>
          <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-white/20 pt-5">
            {[
              ["10", t("minutes to use")],
              ["1", t("code, one use")],
              ["6", t("digits")],
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
          {t("Wassl · Southern Morocco")}
        </p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[400px]">
          <div className="mb-10 flex items-center justify-between lg:hidden">
            <Logo />
            <Link href="/login" className="inline-flex items-center gap-1 text-[12px] text-muted">
              <ArrowLeft size={13} className="rtl:-scale-x-100" /> {t("Sign in")}
            </Link>
          </div>

          <div className="mb-6 flex items-center justify-end gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>

          <div className="grid h-11 w-11 place-items-center rounded-[6px] bg-surface-2 text-ink">
            <Mail size={18} />
          </div>
          <h2 className="display mt-4 text-[clamp(2rem,1.6rem+1.4vw,2.7rem)]">
            {t("Verify your email")}
          </h2>
          <p className="mt-3 text-[13px] leading-6 text-muted">
            {context === "login"
              ? t("Enter the code we sent to {email} to finish signing in.", {
                  email: maskedEmail,
                })
              : t("Enter the code we sent to {email} to finish creating your account.", {
                  email: maskedEmail,
                })}
          </p>
          <p className="mt-1.5 text-[11px] text-muted">
            {t("The code expires in 10 minutes.")}
          </p>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void verify(code);
            }}
            className="mt-7"
          >
            <fieldset>
              <legend className="label">{t("Verification code")}</legend>
              <div
                className="flex justify-between gap-1.5"
                onPaste={onPaste}
                role="group"
                aria-label={t("Verification code")}
              >
                {digits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(node) => {
                      inputs.current[index] = node;
                    }}
                    value={digit}
                    onChange={(event) => setDigit(index, event.target.value)}
                    onKeyDown={(event) => onKeyDown(index, event)}
                    onFocus={(event) => event.currentTarget.select()}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    aria-label={t("Digit {n}", { n: index + 1 })}
                    aria-invalid={Boolean(error)}
                    className={`h-12 w-10 rounded-[6px] border bg-surface text-center text-[20px] font-semibold tnum outline-none transition-colors sm:h-[52px] sm:w-11 ${
                      error
                        ? "border-danger text-danger"
                        : "border-line text-ink focus:border-brand"
                    }`}
                  />
                ))}
              </div>
            </fieldset>

            <p className="mt-3 text-[11px] text-muted">
              {t("Didn't get it? Check spam, then resend.")}
            </p>

            {error ? (
              <p
                role="alert"
                className="mt-4 border-s-2 border-danger ps-3 text-[12px] leading-5 text-danger"
              >
                {error}
              </p>
            ) : notice ? (
              <p role="status" className="mt-4 border-s-2 border-brand ps-3 text-[12px] leading-5 text-muted">
                {notice}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={code.length !== LENGTH || busy}
              className="btn btn-primary mt-5 w-full disabled:opacity-50"
            >
              {busy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}
              {busy ? t("Verifying…") : t("Verify email")}
            </button>
          </form>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <button
              type="button"
              onClick={resend}
              disabled={busy || seconds > 0}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-brand disabled:text-muted"
            >
              <RotateCcw size={12} />
              {seconds > 0
                ? t("Resend in {seconds}s", { seconds })
                : t("Resend code")}
            </button>
            <Link href="/login" className="text-[12px] text-muted hover:text-ink">
              {t("Use a different email")}
            </Link>
          </div>

          <p className="mt-8 text-[11px] leading-5 text-muted">
            {t(
              "If you did not request this code, ignore the email. Nobody can open your account without it.",
            )}
          </p>
        </div>
      </section>
    </main>
  );
}
