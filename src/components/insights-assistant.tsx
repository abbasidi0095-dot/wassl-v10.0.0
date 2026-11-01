"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { useI18n } from "@/components/locale-provider";

const MERCHANT_QUESTIONS = [
  "What were my best-selling products?",
  "Which products need restocking?",
  "How did this week compare with last week?",
  "Which products are slow-moving?",
];

const ADMIN_QUESTIONS = [
  "How many active orders are there?",
  "Which city has the highest demand?",
  "Which stores have the most cancellations?",
  "What is today's platform margin?",
];

export function InsightsAssistant({
  role,
}: {
  role: "merchant" | "admin";
}) {
  const { t } = useI18n();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const examples = role === "merchant" ? MERCHANT_QUESTIONS : ADMIN_QUESTIONS;

  async function ask(value: string) {
    const text = value.trim();
    if (!text) return;
    setLoading(true);
    setError("");
    setAnswer("");
    try {
      const response = await fetch("/api/ai/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      const data = (await response.json()) as { answer?: string; error?: string };
      if (!response.ok || !data.answer) {
        setError(data.error || t("Could not answer right now."));
        return;
      }
      setAnswer(data.answer);
    } catch {
      setError(t("Could not answer right now."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="aero-tile rounded-[10px] border p-5">
      <div className="flex items-center gap-2">
        <Sparkles size={15} className="text-brand" />
        <h2 className="text-[13px] font-semibold">{t("Wassl Insights")}</h2>
      </div>
      <p className="mt-1 text-[11px] text-muted">
        {role === "merchant"
          ? t("Ask about your own sales, stock and orders. Read-only.")
          : t("Ask about live operations and platform metrics. Read-only.")}
      </p>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
        }}
      >
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          className="input h-9 flex-1 text-[12px]"
          placeholder={t("Ask a question…")}
          aria-label={t("Ask Wassl Insights")}
        />
        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary btn-sm shrink-0 disabled:opacity-40"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {t("Ask")}
        </button>
      </form>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {examples.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => {
              setQuestion(example);
              void ask(example);
            }}
            className="rounded-full border border-line bg-surface px-2.5 py-1 text-[10px] text-muted hover:border-line-strong hover:text-ink"
          >
            {t(example)}
          </button>
        ))}
      </div>
      {error ? (
        <p className="mt-3 rounded-[6px] bg-danger-soft px-3 py-2 text-[11px] text-danger">
          {error}
        </p>
      ) : null}
      {answer ? (
        <div className="mt-3 rounded-[8px] border border-line bg-surface-2/60 p-3 text-[12px] leading-6">
          {answer}
        </div>
      ) : null}
    </section>
  );
}
