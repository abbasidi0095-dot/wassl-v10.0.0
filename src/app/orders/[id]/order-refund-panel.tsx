"use client";

import { useEffect, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { useI18n } from "@/components/locale-provider";
import type { RefundRequest } from "@/lib/types";
import { money } from "@/lib/utils";

export function OrderRefundPanel({ orderId }: { orderId: string }) {
  const { t } = useI18n();
  const [request, setRequest] = useState<RefundRequest | null>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [restock, setRestock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/refunds", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { requests: [] }))
      .then((data: { requests?: RefundRequest[] }) => {
        setRequest(
          (data.requests ?? []).find((item) => item.orderId === orderId) ?? null,
        );
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, [orderId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || reason.trim().length < 4) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, reason, restock }),
      });
      const data = (await response.json()) as { refund?: RefundRequest; error?: string };
      if (!response.ok || !data.refund) {
        setError(data.error || t("Could not submit the refund request"));
        return;
      }
      setRequest(data.refund);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return null;

  return (
    <div className="card-flat mt-3 p-4">
      <div className="flex items-center gap-2 text-sm font-extrabold">
        <RotateCcw size={15} className="text-teal" />
        {t("Returns & refunds")}
      </div>
      {request ? (
        <div className="mt-2 rounded-xl bg-cream p-3 text-[11px] font-bold text-ink/55">
          <div className="flex items-center justify-between">
            <span>{t("Refund request")}</span>
            <span className="pill">{t(request.status)}</span>
          </div>
          <div className="mt-1">{money(request.amount)} · {request.reason}</div>
          {request.adminNote ? (
            <div className="mt-1 text-ink/40">{t("Operations note")}: {request.adminNote}</div>
          ) : null}
        </div>
      ) : open ? (
        <form onSubmit={submit} className="mt-2 space-y-2">
          <textarea
            className="input min-h-20 text-xs"
            placeholder={t("Tell us what went wrong")}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
          />
          <label className="flex items-center gap-2 text-[11px] font-bold text-ink/50">
            <input
              type="checkbox"
              checked={restock}
              onChange={(event) => setRestock(event.target.checked)}
              className="h-3.5 w-3.5 accent-teal"
            />
            {t("Return the items to the store")}
          </label>
          {error ? <p className="text-[11px] font-bold text-coral">{error}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn btn-ghost btn-sm flex-1"
            >
              {t("Cancel")}
            </button>
            <button
              type="submit"
              disabled={busy || reason.trim().length < 4}
              className="btn btn-primary btn-sm flex-1"
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
              {t("Request refund")}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn btn-ghost btn-sm mt-2 w-full"
        >
          <RotateCcw size={13} />
          {t("Request a refund or return")}
        </button>
      )}
    </div>
  );
}
