"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Star } from "lucide-react";
import type { Rating } from "@/lib/types";
import { useI18n } from "@/components/locale-provider";

export function RatingPrompt({
  kind,
  id,
  initial,
  subject,
}: {
  kind: "order" | "ride";
  id: string;
  initial?: Rating;
  subject?: string;
}) {
  const { t } = useI18n();
  const [rating, setRating] = useState<Rating | undefined>(initial);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!stars) {
      setError(t("Choose 1 to 5 stars."));
      return;
    }
    setLoading(true);
    setError("");
    try {
      const endpoint =
        kind === "order"
          ? `/api/orders/${encodeURIComponent(id)}/rating`
          : `/api/taxi/rides/${encodeURIComponent(id)}/rating`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stars, comment }),
      });
      const data = (await response.json()) as { rating?: Rating; error?: string };
      if (!response.ok || !data.rating) {
        setError(data.error || t("Could not save your rating."));
        return;
      }
      setRating(data.rating);
    } catch {
      setError(t("Could not save your rating."));
    } finally {
      setLoading(false);
    }
  }

  if (rating) {
    return (
      <div className="aero-tile rounded-[10px] border p-5">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-success">
          <CheckCircle2 size={16} /> {t("Thank you for rating")}
        </div>
        <div className="mt-2 flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <Star
              key={value}
              size={18}
              className={
                value <= rating.stars
                  ? "fill-signal text-signal"
                  : "text-line-strong"
              }
            />
          ))}
          <span className="ms-2 text-[12px] font-semibold tnum">{rating.stars}/5</span>
        </div>
        {rating.comment ? (
          <p className="mt-2 text-[12px] text-muted">{rating.comment}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="aero-tile rounded-[10px] border p-5">
      <h2 className="text-[14px] font-semibold">
        {kind === "order" ? t("How was your order?") : t("How was your ride?")}
      </h2>
      <p className="mt-1 text-[11px] text-muted">
        {subject || t("Your rating helps the next customer and the local team.")}
      </p>
      <div className="mt-3 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setStars(value)}
            className="grid h-10 w-10 place-items-center rounded-[6px] transition-colors hover:bg-surface-2"
            aria-label={t("{count} stars", { count: value })}
            aria-pressed={stars === value}
          >
            <Star
              size={24}
              className={
                value <= stars ? "fill-signal text-signal" : "text-line-strong"
              }
            />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        className="input mt-3 min-h-16 text-[12px]"
        placeholder={t("Optional comment")}
        aria-label={t("Optional comment")}
      />
      {error ? <p className="mt-2 text-[11px] text-danger">{error}</p> : null}
      <button
        type="button"
        onClick={submit}
        disabled={loading}
        className="btn btn-primary btn-sm mt-3 disabled:opacity-40"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <Star size={12} />}
        {t("Send rating")}
      </button>
    </div>
  );
}
