"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  CarTaxiFront,
  CircleDot,
  Loader2,
  MapPin,
  Phone,
} from "lucide-react";
import { useI18n } from "@/components/locale-provider";
import type { Driver, TaxiRide, TaxiStatus } from "@/lib/types";
import { TAXI_STATUS_TEXT } from "@/lib/taxi-status";
import { money } from "@/lib/utils";

export function DriverTaxiQueue({
  driver,
  initialOpen,
  initialAssigned,
}: {
  driver: Driver;
  initialOpen: TaxiRide[];
  initialAssigned: TaxiRide[];
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(initialOpen);
  const [assigned, setAssigned] = useState(initialAssigned);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/taxi/queue", { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as {
      open?: TaxiRide[];
      assigned?: TaxiRide[];
    };
    if (data.open) setOpen(data.open);
    if (data.assigned) setAssigned(data.assigned);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function move(ride: TaxiRide, status: TaxiStatus) {
    setBusy(ride.id);
    setError("");
    try {
      const response = await fetch(`/api/taxi/rides/${ride.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || t("Could not update the ride"));
        return;
      }
      await refresh();
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">{driver.citySlug} · {t("Taxi")}</div>
          <h1 className="display mt-2 text-4xl">{t("Taxi rides")}</h1>
          <p className="mt-1 text-sm text-ink/45">
            {t("Accept a nearby request and collect the fare in cash.")}
          </p>
        </div>
        <span className="pill pill-warm">{money(driver.cashOnHand)}</span>
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">{error}</p>
      ) : null}

      <section>
        <h2 className="text-sm font-extrabold">{t("Your trip")}</h2>
        {assigned.length ? (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {assigned.map((ride) => {
              const next: TaxiStatus | null =
                ride.status === "accepted"
                  ? "arriving"
                  : ride.status === "arriving"
                    ? "in_progress"
                    : ride.status === "in_progress"
                      ? "completed"
                      : null;
              const nextLabel =
                ride.status === "accepted"
                  ? t("On my way")
                  : ride.status === "arriving"
                    ? t("Start trip")
                    : t("Complete trip");
              return (
                <div key={ride.id} className="card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="pill">{t(TAXI_STATUS_TEXT[ride.status])}</span>
                    <span className="text-sm font-extrabold">{money(ride.fare)}</span>
                  </div>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <CircleDot size={14} className="mt-0.5 shrink-0 text-teal" />
                      <span className="font-bold">{ride.pickupLabel}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin size={14} className="mt-0.5 shrink-0 text-coral" />
                      <span className="font-bold">{ride.dropoffLabel}</span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink/45">
                    <span>
                      {ride.customerName} · {ride.distanceKm.toFixed(1)} km
                    </span>
                    <a
                      href={`tel:${ride.customerPhone.replace(/\s/g, "")}`}
                      className="btn btn-ghost btn-sm"
                    >
                      <Phone size={12} />
                      {t("Call")}
                    </a>
                  </div>
                  {next ? (
                    <button
                      type="button"
                      onClick={() => move(ride, next)}
                      disabled={busy === ride.id}
                      className="btn btn-primary mt-3 w-full"
                    >
                      {busy === ride.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <ArrowRight size={14} className="rtl:-scale-x-100" />
                      )}
                      {nextLabel}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card mt-3 grid place-items-center px-6 py-10 text-center">
            <CarTaxiFront size={22} className="text-teal" />
            <p className="mt-2 text-sm font-bold text-ink/45">{t("No rides yet")}</p>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-extrabold">{t("Open requests")}</h2>
        {open.length ? (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {open.map((ride) => (
              <div key={ride.id} className="card p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="pill">{t("Ride requested")}</span>
                  <span className="text-sm font-extrabold">{money(ride.fare)}</span>
                </div>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <CircleDot size={14} className="mt-0.5 shrink-0 text-teal" />
                    <span className="font-bold">{ride.pickupLabel}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin size={14} className="mt-0.5 shrink-0 text-coral" />
                    <span className="font-bold">{ride.dropoffLabel}</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-ink/45">
                  <span>
                    {ride.distanceKm.toFixed(1)} km · {t("Cash to driver")}
                  </span>
                  <button
                    type="button"
                    onClick={() => move(ride, "accepted")}
                    disabled={busy === ride.id}
                    className="btn btn-primary btn-sm"
                  >
                    {busy === ride.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : null}
                    {t("Accept ride")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card mt-3 grid place-items-center px-6 py-10 text-center">
            <p className="text-sm font-bold text-ink/45">{t("No rides yet")}</p>
          </div>
        )}
      </section>
    </div>
  );
}
