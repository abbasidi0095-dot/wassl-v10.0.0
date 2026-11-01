"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Loader2,
  MessageCircle,
  MessageSquareText,
  Send,
  Smartphone,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { useI18n } from "@/components/locale-provider";

const LENGTH = 6;

export function VerifyPhoneForm({
  email,
  ticket,
  maskedPhone,
  context,
  channels,
  defaultChannel,
}: {
  email: string;
  ticket: string;
  maskedPhone: string;
  context: "signup" | "login";
  channels: ("sms" | "whatsapp")[];
  defaultChannel: "sms" | "whatsapp" | null;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [channel, setChannel] = useState<"sms" | "whatsapp" | null>(
    defaultChannel ?? channels[0] ?? null,
  );
  const [sent, setSent] = useState(false);
  const [notice, setNotice] = useState(
    channels.length
      ? t("Choose how to receive your code, then tap send.")
      : t("Phone verification is temporarily unavailable. Contact support."),
  );
  const [seconds, setSeconds] = useState(0);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const submitting = useRef(false);
  const code = digits.join("");

  useEffect(() => {
    if (sent) inputs.current[0]?.focus();
  }, [sent]);

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
      const response = await fetch("/api/auth/verify/phone/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: value, ticket }),
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
      setNotice(t("Mobile verified. Opening your account…"));
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

  function chooseChannel(next: "sms" | "whatsapp") {
    if (busy || next === channel) return;
    setChannel(next);
    setSent(false);
    setSeconds(0);
    setDigits(Array(LENGTH).fill(""));
    setError("");
    setNotice(t("Choose how to receive your code, then tap send."));
  }

  async function sendCode() {
    if (!channel || busy || (sent && seconds > 0)) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/verify/phone/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, ticket, channel }),
      });
      const data = (await response.json()) as {
        error?: string;
        retryAfterSeconds?: number;
        resendAfterSeconds?: number;
        devCode?: string;
      };
      if (!response.ok) {
        setError(
          data.error ||
            t("We could not send the code. Try the other channel or contact support."),
        );
        setSeconds(data.retryAfterSeconds ?? 30);
        return;
      }
      setSent(true);
      setDigits(Array(LENGTH).fill(""));
      setSeconds(data.resendAfterSeconds ?? 60);
      setNotice(
        channel === "whatsapp"
          ? t("Code sent to {phone} on WhatsApp.", { phone: maskedPhone })
          : t("Code sent to {phone} by SMS.", { phone: maskedPhone }),
      );
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
            {t("One mobile.")}
            <br />
            {t("One verified")}
            <br />
            {t("number.")}
          </h1>
          <p className="mt-6 max-w-md text-[14px] leading-6 opacity-60">
            {t(
              "We text a six-digit code to your Moroccan mobile so drivers, support and delivery updates reach the right person — not just anyone who knows the password.",
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
            <Smartphone size={18} />
          </div>
          <h2 className="display mt-4 text-[clamp(2rem,1.6rem+1.4vw,2.7rem)]">
            {t("Verify your mobile")}
          </h2>
          <p className="mt-3 text-[13px] leading-6 text-muted">
            {context === "login"
              ? t("Enter the code sent to {phone} to finish signing in.", {
                  phone: maskedPhone,
                })
              : t(
                  "Choose SMS or WhatsApp, then enter the code sent to {phone} to finish creating your account.",
                  { phone: maskedPhone },
                )}
          </p>
          <p className="mt-1.5 text-[11px] text-muted">
            {t("The code expires in 10 minutes.")}
          </p>

          <div className="mt-6">
            <span className="label">{t("Send my code by")}</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {channels.map((id) => {
                const active = channel === id;
                const Icon = id === "whatsapp" ? MessageCircle : MessageSquareText;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => chooseChannel(id)}
                    disabled={busy}
                    className={`flex items-center gap-2 rounded-[8px] border p-3 text-start transition-colors ${
                      active
                        ? "border-brand bg-brand-soft/60 ring-1 ring-brand/20"
                        : "border-line bg-surface hover:border-line-strong"
                    }`}
                  >
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-[6px] ${
                        active ? "bg-brand text-on-dark" : "bg-surface-2 text-brand"
                      }`}
                    >
                      <Icon size={15} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[12px] font-semibold">
                        {id === "whatsapp" ? t("WhatsApp") : t("SMS")}
                      </span>
                      <span className="block text-[10px] text-muted">
                        {id === "whatsapp" ? t("Chat message") : t("Text message")}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            {channels.length ? (
              <p className="mt-2 text-[10px] leading-4 text-muted">
                {t(
                  "Switching channels sends a new code and cancels the previous one.",
                )}
              </p>
            ) : (
              <p className="mt-2 text-[12px] leading-5 text-danger">
                {t(
                  "No verification channel is active yet. Contact Wassl support.",
                )}
              </p>
            )}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void verify(code);
            }}
            className="mt-5"
          >
            <button
              type="button"
              onClick={sendCode}
              disabled={!channel || busy || (sent && seconds > 0)}
              className="btn btn-primary mb-5 w-full disabled:opacity-50"
            >
              {busy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={15} />
              )}
              {sent
                ? seconds > 0
                  ? t("Resend in {seconds}s", { seconds })
                  : t("Resend code")
                : t("Send code")}
            </button>
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
                    disabled={!sent || busy}
                    className={`h-12 w-10 rounded-[6px] border bg-surface text-center text-[20px] font-semibold tnum outline-none transition-colors disabled:opacity-40 sm:h-[52px] sm:w-11 ${
                      error
                        ? "border-danger text-danger"
                        : "border-line text-ink focus:border-brand"
                    }`}
                  />
                ))}
              </div>
            </fieldset>

            {sent ? (
              <p className="mt-3 text-[11px] text-muted">
                {t("Didn't get it? Check your connection, then resend.")}
              </p>
            ) : null}

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
              {busy ? t("Verifying…") : t("Verify mobile")}
            </button>
          </form>

          <div className="mt-5 border-t border-line pt-5">
            <Link href="/login" className="text-[12px] text-muted hover:text-ink">
              {t("Back to sign in")}
            </Link>
          </div>

          <p className="mt-8 text-[11px] leading-5 text-muted">
            {t(
              "If you did not request this code, ignore the message. Nobody can open your account without it.",
            )}
          </p>
        </div>
      </section>
    </main>
  );
}
