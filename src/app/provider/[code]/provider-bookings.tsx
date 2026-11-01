"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import type { ServiceBooking } from "@/lib/types";
import { SERVICE_STATUS_TEXT } from "@/lib/services";
import { money } from "@/lib/utils";
import { useI18n } from "@/components/locale-provider";

export function ProviderBookings({
  initial,
  accessCode,
}: {
  initial: ServiceBooking[];
  accessCode: string;
}) {
  const { t } = useI18n();
  const [bookings, setBookings] = useState(initial);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function move(booking: ServiceBooking, status: "confirmed" | "completed") {
    setBusy(booking.id);
    setError("");
    try {
      const response = await fetch(`/api/services/bookings/${booking.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, accessCode }),
      });
      const data = (await response.json()) as {
        booking?: ServiceBooking;
        error?: string;
      };
      if (!response.ok || !data.booking) {
        setError(data.error || t("Could not update the booking."));
        return;
      }
      setBookings((current) =>
        current.map((entry) => (entry.id === data.booking!.id ? data.booking! : entry)),
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <div>
      {error ? (
        <p className="mt-3 rounded-[6px] bg-danger-soft px-3 py-2 text-[12px] text-danger">
          {error}
        </p>
      ) : null}
      <div className="mt-4 space-y-3">
        {bookings.map((booking) => (
          <article key={booking.id} className="aero-tile rounded-[10px] border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                  {t(SERVICE_STATUS_TEXT[booking.status])}
                </div>
                <div className="mt-1 font-display text-[18px] font-semibold">
                  {booking.code} · {booking.service}
                </div>
                <div className="mt-1 text-[12px] text-muted">
                  {booking.date} · {booking.slot}
                </div>
              </div>
              <div className="text-[13px] font-semibold tnum">
                {booking.amount ? money(booking.amount) : "—"}
              </div>
            </div>
            <p className="mt-2 text-[12px]">{booking.description}</p>
            <div className="mt-2 rounded-[6px] bg-surface-2 p-3 text-[11px]">
              <div className="font-semibold">{booking.customerName}</div>
              <div className="text-muted">{booking.customerPhone}</div>
              <div className="mt-1 text-muted">
                {booking.address} · {booking.landmark}
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              {booking.status === "requested" ? (
                <button
                  type="button"
                  onClick={() => void move(booking, "confirmed")}
                  disabled={busy === booking.id}
                  className="btn btn-primary btn-sm disabled:opacity-40"
                >
                  {busy === booking.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={12} />
                  )}
                  {t("Confirm booking")}
                </button>
              ) : null}
              {booking.status === "confirmed" ? (
                <button
                  type="button"
                  onClick={() => void move(booking, "completed")}
                  disabled={busy === booking.id}
                  className="btn btn-primary btn-sm disabled:opacity-40"
                >
                  {busy === booking.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={12} />
                  )}
                  {t("Mark completed")}
                </button>
              ) : null}
            </div>
          </article>
        ))}
        {!bookings.length ? (
          <div className="rounded-[8px] border border-dashed border-line px-5 py-12 text-center text-[12px] text-muted">
            {t("No bookings yet.")}
          </div>
        ) : null}
      </div>
    </div>
  );
}
