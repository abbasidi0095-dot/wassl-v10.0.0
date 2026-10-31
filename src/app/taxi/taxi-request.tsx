"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CarTaxiFront,
  CircleDot,
  Loader2,
  MapPin,
  Navigation,
} from "lucide-react";
import { MapView } from "@/components/map-view";
import { useI18n } from "@/components/locale-provider";
import type { City, TaxiRide } from "@/lib/types";
import { estimateTaxiFare, haversineKm } from "@/lib/taxi";
import { TAXI_STATUS_TEXT } from "@/lib/taxi-status";
import { money } from "@/lib/utils";

type Target = "pickup" | "dropoff";

export function TaxiRequest({
  cities,
  defaultCitySlug,
  activeRide,
  history,
}: {
  cities: City[];
  defaultCitySlug: string;
  activeRide: TaxiRide | null;
  history: TaxiRide[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const initialCity = cities.find((city) => city.slug === defaultCitySlug) ?? cities[0];

  const [citySlug, setCitySlug] = useState(initialCity?.slug || "dakhla");
  const [pickup, setPickup] = useState({
    lat: (initialCity?.lat ?? 23.6848) + 0.004,
    lng: (initialCity?.lng ?? -15.958) + 0.004,
  });
  const [dropoff, setDropoff] = useState({
    lat: (initialCity?.lat ?? 23.6848) - 0.02,
    lng: (initialCity?.lng ?? -15.958) - 0.015,
  });
  const [pickupLabel, setPickupLabel] = useState("");
  const [dropoffLabel, setDropoffLabel] = useState("");
  const [target, setTarget] = useState<Target>("dropoff");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const distance = useMemo(
    () => haversineKm(pickup, dropoff),
    [pickup, dropoff],
  );
  const fare = estimateTaxiFare(distance);

  function changeCity(nextSlug: string) {
    const city = cities.find((item) => item.slug === nextSlug);
    if (!city) return;
    setCitySlug(city.slug);
    setPickup({ lat: city.lat + 0.004, lng: city.lng + 0.004 });
    setDropoff({ lat: city.lat - 0.02, lng: city.lng - 0.015 });
  }

  function pick(lat: number, lng: number) {
    if (target === "pickup") {
      setPickup({ lat, lng });
      setTarget("dropoff");
    } else {
      setDropoff({ lat, lng });
      setTarget("pickup");
    }
  }

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/taxi/rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          citySlug,
          pickupLabel,
          dropoffLabel,
          pickupLat: pickup.lat,
          pickupLng: pickup.lng,
          dropoffLat: dropoff.lat,
          dropoffLng: dropoff.lng,
        }),
      });
      const data = (await response.json()) as { ride?: TaxiRide; error?: string };
      if (!response.ok || !data.ride) {
        setError(data.error || t("Could not request the ride"));
        return;
      }
      router.push(`/taxi/${data.ride.id}`);
    } catch {
      setError(t("Could not request the ride"));
    } finally {
      setSubmitting(false);
    }
  }

  if (activeRide) {
    return (
      <div className="space-y-4">
        <div className="overflow-hidden rounded-[10px] border border-line bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
            <span className="inline-flex items-center gap-2 text-[13px] font-medium">
              <span className="status-dot live-dot text-success" />
              {t(TAXI_STATUS_TEXT[activeRide.status])}
            </span>
            <span className="text-[13px] font-semibold tnum">{money(activeRide.fare)}</span>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <CircleDot size={15} className="mt-0.5 shrink-0 text-brand" />
                <div>
                  <div className="text-[11px] text-muted">
                    {t("Pickup point")}
                  </div>
                  <div className="font-medium">{activeRide.pickupLabel}</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin size={15} className="mt-0.5 shrink-0 text-danger" />
                <div>
                  <div className="text-[11px] text-muted">
                    {t("Destination")}
                  </div>
                  <div className="font-medium">{activeRide.dropoffLabel}</div>
                </div>
              </div>
            </div>
            <div className="flex flex-col justify-end gap-2">
              {activeRide.driverName ? (
                <div className="rounded-[6px] bg-surface-2 p-3 text-[13px]">
                  <div className="text-[11px] text-muted">
                    {t("Your driver")}
                  </div>
                  <div className="mt-0.5 font-medium">{activeRide.driverName}</div>
                  <div className="text-muted">
                    {activeRide.vehicle} · {activeRide.plate}
                  </div>
                </div>
              ) : null}
              <Link href={`/taxi/${activeRide.id}`} className="btn btn-primary">
                {t("Track ride")}
                <ArrowRight size={15} className="rtl:-scale-x-100" />
              </Link>
            </div>
          </div>
        </div>

        {history.length ? <TaxiHistory rides={history} /> : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="order-2 overflow-hidden rounded-[10px] border border-line bg-surface p-2 lg:order-1">
          <MapView
            points={[
              {
                id: "pickup",
                lat: pickup.lat,
                lng: pickup.lng,
                kind: "pickup",
                label: pickupLabel || t("Pickup point"),
              },
              {
                id: "dropoff",
                lat: dropoff.lat,
                lng: dropoff.lng,
                kind: "dropoff",
                label: dropoffLabel || t("Destination"),
              },
            ]}
            center={pickup}
            zoom={13.5}
            height={360}
            onPick={pick}
            className="rounded-[6px]"
          />
        </div>

        <div className="order-1 rounded-[10px] border border-line bg-surface p-5 lg:order-2">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="text-[15px] font-semibold">
              {t("Request a ride")}
            </div>
            <CarTaxiFront size={16} className="text-muted" />
          </div>

          <label className="mt-4 block">
            <span className="label">{t("City")}</span>
            <select
              value={citySlug}
              onChange={(event) => changeCity(event.target.value)}
              className="input"
            >
              {cities.map((city) => (
                <option key={city.id} value={city.slug}>
                  {city.name} — {city.nameAr}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {(["pickup", "dropoff"] as Target[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTarget(item)}
                className={`rounded-[6px] border px-3 py-2 text-start text-[13px] transition-colors ${
                  target === item
                    ? "border-ink bg-surface-2 font-medium text-ink"
                    : "border-line text-muted hover:text-ink"
                }`}
              >
                <span className="block text-[11px] text-muted">
                  {item === "pickup" ? t("Pickup") : t("Drop-off")}
                </span>
                {item === "pickup" ? pickupLabel || t("Pickup point") : dropoffLabel || t("Destination")}
              </button>
            ))}
          </div>

          <p className="mt-2 text-[11px] text-muted">
            {t("Tap the map to move the")} {target === "pickup" ? t("Pickup point") : t("Destination")}.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label">{t("Pickup")}</span>
              <input
                className="input"
                value={pickupLabel}
                onChange={(event) => setPickupLabel(event.target.value)}
                placeholder={t("Where from?")}
              />
            </label>
            <label className="block">
              <span className="label">{t("Drop-off")}</span>
              <input
                className="input"
                value={dropoffLabel}
                onChange={(event) => setDropoffLabel(event.target.value)}
                placeholder={t("Where to?")}
              />
            </label>
          </div>

          <div className="mt-4 flex items-end justify-between rounded-[6px] bg-surface-2 p-3">
            <div>
              <div className="text-[11px] font-medium text-muted">
                {t("Distance")}
              </div>
              <div className="text-sm font-semibold">{distance.toFixed(1)} km</div>
            </div>
            <div className="text-end">
              <div className="text-[11px] font-medium text-muted">
                {t("Estimated fare")}
              </div>
              <div className="text-2xl font-semibold tracking-[-0.04em]">{money(fare)}</div>
            </div>
          </div>

          {error ? (
            <p className="mt-3 rounded-[6px] bg-danger-soft px-3 py-2 text-xs font-bold text-danger">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={submit}
            disabled={submitting || distance < 0.15}
            className="btn btn-primary mt-4 w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />}
            {submitting ? t("Requesting…") : t("Request taxi")}
          </button>
          <p className="mt-2 text-center text-[11px] font-bold text-muted">
            {t("Cash to driver")} · {t("No card needed")}
          </p>
        </div>
      </div>

      {history.length ? <TaxiHistory rides={history} /> : null}
    </div>
  );
}

function TaxiHistory({ rides }: { rides: TaxiRide[] }) {
  const { t } = useI18n();
  return (
    <div className="overflow-hidden rounded-[10px] border border-line bg-surface">
      <div className="border-b border-line px-4 py-3 text-sm font-semibold">
        {t("Trip history")}
      </div>
      <div className="divide-y divide-ink/5">
        {rides.map((ride) => (
          <Link
            key={ride.id}
            href={`/taxi/${ride.id}`}
            className="flex items-center justify-between gap-3 px-4 py-3 text-xs hover:bg-surface-2/60"
          >
            <span className="min-w-0">
              <span className="block truncate font-semibold">
                {ride.pickupLabel} → {ride.dropoffLabel}
              </span>
              <span className="text-[11px] text-muted">
                {new Date(ride.createdAt).toLocaleDateString()} · {ride.distanceKm.toFixed(1)} km
              </span>
            </span>
            <span className="shrink-0 text-end">
              <span className="block font-semibold">{money(ride.fare)}</span>
              <span className="text-[11px] text-muted">{t(TAXI_STATUS_TEXT[ride.status])}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
