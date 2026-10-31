"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  CarTaxiFront,
  CheckCircle2,
  Circle,
  Loader2,
  MapPin,
  Phone,
  XCircle,
} from "lucide-react";
import { MapView } from "@/components/map-view";
import { useI18n } from "@/components/locale-provider";
import type { TaxiRide } from "@/lib/types";
import { TAXI_STATUS_ORDER, TAXI_STATUS_TEXT } from "@/lib/taxi-status";
import { money } from "@/lib/utils";

export function TaxiTracking({ ride: initialRide, role }: { ride: TaxiRide; role: string }) {
  const { t } = useI18n();
  const [ride, setRide] = useState(initialRide);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = !["completed", "cancelled"].includes(ride.status);

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/taxi/rides/${ride.id}`, { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as { ride?: TaxiRide };
    if (data.ride) setRide(data.ride);
  }, [ride.id]);

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => void refresh(), 4000);
    return () => window.clearInterval(timer);
  }, [active, refresh]);

  async function cancel() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/taxi/rides/${ride.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      const data = (await response.json()) as { ride?: TaxiRide; error?: string };
      if (!response.ok || !data.ride) {
        setError(data.error || t("Could not update the ride"));
        return;
      }
      setRide(data.ride);
    } finally {
      setBusy(false);
    }
  }

  const stepIndex = TAXI_STATUS_ORDER.indexOf(ride.status);

  return (
    <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="space-y-4">
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/8 bg-cream/60 px-5 py-3">
            <span className="inline-flex items-center gap-2 text-xs font-extrabold">
              {ride.status === "completed" ? (
                <CheckCircle2 size={15} className="text-teal" />
              ) : ride.status === "cancelled" ? (
                <XCircle size={15} className="text-coral" />
              ) : (
                <span className="status-dot live-dot text-teal" />
              )}
              {t(TAXI_STATUS_TEXT[ride.status])}
            </span>
            <span className="pill">{money(ride.fare)}</span>
          </div>
          <div className="p-2">
            <MapView
              points={[
                {
                  id: "pickup",
                  lat: ride.pickupLat,
                  lng: ride.pickupLng,
                  kind: "pickup",
                  label: ride.pickupLabel,
                },
                {
                  id: "dropoff",
                  lat: ride.dropoffLat,
                  lng: ride.dropoffLng,
                  kind: "dropoff",
                  label: ride.dropoffLabel,
                },
              ]}
              center={{ lat: ride.pickupLat, lng: ride.pickupLng }}
              zoom={13.5}
              height={300}
              route={[
                [ride.pickupLat, ride.pickupLng],
                [ride.dropoffLat, ride.dropoffLng],
              ]}
              className="rounded-[18px]"
            />
          </div>
        </div>

        <div className="card p-5">
          <div className="text-sm font-extrabold">{t("Ride details")}</div>
          <div className="mt-3 space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <Circle size={14} className="mt-0.5 shrink-0 text-teal" />
              <div>
                <div className="text-[9px] font-extrabold uppercase tracking-wider text-ink/40">
                  {t("Pickup point")}
                </div>
                <div className="font-bold">{ride.pickupLabel}</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin size={14} className="mt-0.5 shrink-0 text-coral" />
              <div>
                <div className="text-[9px] font-extrabold uppercase tracking-wider text-ink/40">
                  {t("Destination")}
                </div>
                <div className="font-bold">{ride.dropoffLabel}</div>
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-ink/8 pt-3 text-center">
            <div>
              <div className="text-[9px] font-extrabold uppercase tracking-wider text-ink/40">
                {t("Distance")}
              </div>
              <div className="text-sm font-extrabold">{ride.distanceKm.toFixed(1)} km</div>
            </div>
            <div>
              <div className="text-[9px] font-extrabold uppercase tracking-wider text-ink/40">
                {t("Fare")}
              </div>
              <div className="text-sm font-extrabold">{money(ride.fare)}</div>
            </div>
            <div>
              <div className="text-[9px] font-extrabold uppercase tracking-wider text-ink/40">
                {t("Payment")}
              </div>
              <div className="text-sm font-extrabold">{t("Cash")}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="card p-5">
          <div className="text-sm font-extrabold">{t("Your driver")}</div>
          {ride.driverName ? (
            <div className="mt-3 flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-teal/10 text-teal">
                <CarTaxiFront size={22} />
              </span>
              <div className="min-w-0">
                <div className="font-extrabold">{ride.driverName}</div>
                <div className="text-xs text-ink/45">
                  {ride.vehicle} · {ride.plate}
                </div>
              </div>
              {ride.driverPhone ? (
                <a
                  href={`tel:${ride.driverPhone.replace(/\s/g, "")}`}
                  className="btn btn-ghost btn-sm ms-auto"
                >
                  <Phone size={13} />
                  {t("Call")}
                </a>
              ) : null}
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-cream p-3 text-xs font-bold text-ink/50">
              <Loader2 size={14} className="animate-spin text-teal" />
              {t("Finding a driver…")}
            </div>
          )}

          <div className="mt-5 space-y-3">
            {TAXI_STATUS_ORDER.map((status, index) => {
              const done = ride.status === "completed" || index <= stepIndex;
              const current = index === stepIndex && active;
              return (
                <div key={status} className="flex items-center gap-2.5">
                  {done ? (
                    <CheckCircle2
                      size={16}
                      className={current ? "text-teal" : "text-teal/40"}
                    />
                  ) : (
                    <Circle size={16} className="text-ink/20" />
                  )}
                  <span
                    className={`text-xs font-bold ${
                      current ? "text-ink" : done ? "text-ink/55" : "text-ink/30"
                    }`}
                  >
                    {t(TAXI_STATUS_TEXT[status])}
                  </span>
                </div>
              );
            })}
          </div>

          {error ? (
            <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
              {error}
            </p>
          ) : null}

          {active && role !== "driver" ? (
            <button
              type="button"
              onClick={cancel}
              disabled={busy}
              className="btn btn-ghost btn-sm mt-4 w-full"
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : null}
              {t("Cancel ride")}
            </button>
          ) : null}

          {!active ? (
            <Link href="/taxi" className="btn btn-primary mt-4 w-full">
              {t("Book another ride")}
              <ArrowRight size={15} className="rtl:-scale-x-100" />
            </Link>
          ) : null}
        </div>

        <div className="rounded-2xl bg-saffron/15 p-4 text-[11px] font-bold leading-5 text-ink/55">
          {t("Pay the driver in cash at the end of the trip.")}
        </div>
      </div>
    </div>
  );
}
