"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, KeyRound, Loader2, ShieldCheck, X } from "lucide-react";

function digitsOf(code: string) {
  return code.replace(/\D/g, "").slice(-4).padStart(4, "0");
}

export function HandoverCode({
  code,
  label = "Handover code",
  note = "Share these four digits only when the order is in your hands.",
  compact = false,
  className = "",
}: {
  code?: string;
  label?: string;
  note?: string;
  compact?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  if (!code) return null;
  const digits = digitsOf(code).split("");
  const value = digits.join("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className={`aero-tile rounded-[10px] border p-4 ${
        compact ? "sm:p-4" : "sm:p-5"
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-brand">
          <ShieldCheck size={14} />
          {label}
        </div>
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-muted transition-colors hover:text-ink"
        >
          {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="mt-3 flex gap-1.5" aria-label={`${label}: ${value}`}>
        {digits.map((digit, index) => (
          <span
            key={`${digit}-${index}`}
            className={`grid place-items-center rounded-[6px] bg-ink font-display font-semibold leading-none tracking-normal text-on-dark tnum ${
              compact ? "h-10 w-9 text-[22px]" : "h-14 w-12 text-[30px]"
            }`}
          >
            {digit}
          </span>
        ))}
      </div>
      <p className="mt-3 max-w-[38ch] text-[11px] leading-5 text-muted">{note}</p>
    </div>
  );
}

export function HandoverPrompt({
  title,
  description,
  busy = false,
  error = "",
  onClose,
  onSubmit,
}: {
  title: string;
  description: string;
  busy?: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (code: string) => void | Promise<void>;
}) {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const value = digits.join("");
  const ready = value.length === 4 && digits.every(Boolean);

  function write(next: string[]) {
    setDigits(next);
    const index = next.findIndex((digit) => !digit);
    if (index >= 0) refs.current[index]?.focus();
  }

  function change(index: number, raw: string) {
    const numeric = raw.replace(/\D/g, "");
    if (!numeric) {
      const next = [...digits];
      next[index] = "";
      write(next);
      return;
    }
    const next = [...digits];
    for (let offset = 0; offset < numeric.length && index + offset < 4; offset += 1) {
      next[index + offset] = numeric[offset];
    }
    write(next);
  }

  function keyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowLeft" && index > 0) refs.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < 3) refs.current[index + 1]?.focus();
  }

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-ink/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="handover-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        className="w-full max-w-sm rounded-[12px] bg-surface p-5 shadow-[var(--shadow-float)]"
        onSubmit={(event) => {
          event.preventDefault();
          if (ready && !busy) void onSubmit(value);
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-[8px] bg-brand-soft text-brand">
            <KeyRound size={19} />
          </span>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-[6px] text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <h2
          id="handover-title"
          className="mt-4 font-display text-[24px] font-semibold tracking-[-0.03em]"
        >
          {title}
        </h2>
        <p className="mt-2 text-[12px] leading-5 text-muted">{description}</p>

        <div className="mt-5 flex justify-center gap-2">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(element) => {
                refs.current[index] = element;
              }}
              value={digit}
              onChange={(event) => change(index, event.target.value)}
              onKeyDown={(event) => keyDown(index, event)}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              aria-label={`Digit ${index + 1}`}
              className="h-16 w-14 rounded-[8px] border border-line bg-surface text-center font-display text-[30px] font-semibold text-ink outline-none transition-colors focus:border-brand tnum"
            />
          ))}
        </div>
        {error ? (
          <p className="mt-3 rounded-[6px] bg-danger-soft px-3 py-2 text-[11px] font-medium text-danger">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!ready || busy}
          className="btn btn-primary mt-5 w-full"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          Confirm handover
        </button>
        <p className="mt-3 text-center text-[10px] leading-4 text-muted">
          The code is on the customer’s screen. Do not mark this complete before you
          have the four digits.
        </p>
      </form>
    </div>
  );
}
