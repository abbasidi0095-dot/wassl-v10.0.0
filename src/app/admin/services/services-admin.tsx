"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { ServiceBooking, ServiceProvider } from "@/lib/types";
import { SERVICE_CATEGORIES, SERVICE_STATUS_TEXT } from "@/lib/services";
import { money, timeAgo } from "@/lib/utils";
import { useI18n } from "@/components/locale-provider";

export function ServicesAdmin({
  initialProviders,
  bookings,
}: {
  initialProviders: ServiceProvider[];
  bookings: ServiceBooking[];
}) {
  const { t } = useI18n();
  const [providers, setProviders] = useState(initialProviders);
  const [busy, setBusy] = useState("");

  async function setStatus(provider: ServiceProvider, status: string) {
    setBusy(provider.id);
    try {
      const response = await fetch(`/api/admin/services/providers/${provider.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = (await response.json()) as {
        provider?: ServiceProvider;
        error?: string;
      };
      if (data.provider) {
        setProviders((current) =>
          current.map((entry) => (entry.id === data.provider!.id ? data.provider! : entry)),
        );
      }
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="mt-5 space-y-5">
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-semibold">{t("Providers")}</h2>
          <span className="pill">{providers.length}</span>
        </div>
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {providers.map((provider) => (
            <article key={provider.id} className="aero-tile rounded-[8px] border p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[13px] font-semibold">{provider.name}</div>
                  <div className="text-[11px] text-muted">
                    {t(
                      SERVICE_CATEGORIES.find((entry) => entry.id === provider.category)?.label ??
                        "Other",
                    )}{" "}
                    · {provider.citySlug} · {t("from")} {money(provider.priceFrom)}
                  </div>
                </div>
                <span className="pill">{t(provider.status)}</span>
              </div>
              <div className="mt-2 text-[11px] text-muted">{provider.description}</div>
              <div className="mt-2 text-[10px] text-muted">
                {t("Access code")}: <span className="font-mono">{provider.accessCode}</span>
              </div>
              <div className="mt-3 flex gap-1">
                {provider.status !== "approved" ? (
                  <button
                    type="button"
                    onClick={() => void setStatus(provider, "approved")}
                    disabled={busy === provider.id}
                    className="btn btn-primary btn-sm"
                  >
                    {busy === provider.id ? <Loader2 size={11} className="animate-spin" /> : null}
                    {t("Approve")}
                  </button>
                ) : null}
                {provider.status !== "suspended" ? (
                  <button
                    type="button"
                    onClick={() => void setStatus(provider, "suspended")}
                    disabled={busy === provider.id}
                    className="btn btn-ghost btn-sm text-danger"
                  >
                    {t("Suspend")}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-semibold">{t("Service bookings")}</h2>
          <span className="pill">{bookings.length}</span>
        </div>
        <div className="mt-3 space-y-2">
          {bookings.map((booking) => {
            const provider = providers.find((entry) => entry.id === booking.providerId);
            return (
              <article key={booking.id} className="aero-tile rounded-[8px] border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-[12px] font-semibold">
                      {booking.code} · {booking.service}
                    </div>
                    <div className="text-[10px] text-muted">
                      {provider?.name} · {booking.customerName} · {booking.customerPhone}
                    </div>
                    <div className="text-[10px] text-muted">
                      {booking.date} {booking.slot} · {timeAgo(booking.createdAt)}
                    </div>
                  </div>
                  <span className="pill">{t(SERVICE_STATUS_TEXT[booking.status])}</span>
                </div>
                <p className="mt-2 text-[11px] text-muted">{booking.description}</p>
                <div className="mt-1 text-[10px] text-muted">
                  {booking.address} · {booking.landmark}
                </div>
              </article>
            );
          })}
          {!bookings.length ? (
            <p className="rounded-[8px] border border-dashed border-line px-4 py-8 text-center text-[11px] text-muted">
              {t("No service bookings yet.")}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
