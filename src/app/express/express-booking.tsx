"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Loader2,
  LocateFixed,
  MapPin,
  Package,
  ShieldCheck,
  Truck,
} from "lucide-react";
import type { City, ParcelDelivery, ParcelSize } from "@/lib/types";
import {
  PARCEL_SIZES,
  PARCEL_STATUS_TEXT,
  estimateParcelFare,
  parcelDistance,
} from "@/lib/express";
import { money } from "@/lib/utils";
import { useI18n } from "@/components/locale-provider";
import { MapView } from "@/components/map-view";

type Target = "pickup" | "dropoff";

export function ExpressBooking({
  cities,
  defaultCity,
  initialParcels,
  initialName,
  initialPhone,
}: {
  cities: City[];
  defaultCity: string;
  initialParcels: ParcelDelivery[];
  initialName: string;
  initialPhone: string;
}) {
  const { t } = useI18n();
  const initialCity = cities.find((city) => city.slug === defaultCity) ?? cities[0];
  const [parcels, setParcels] = useState(initialParcels);
  const [citySlug, setCitySlug] = useState(initialCity.slug);
  const [pickupLabel, setPickupLabel] = useState("");
  const [dropoffLabel, setDropoffLabel] = useState("");
  const [pickup, setPickup] = useState({
    lat: initialCity.lat + 0.004,
    lng: initialCity.lng + 0.004,
  });
  const [dropoff, setDropoff] = useState({
    lat: initialCity.lat - 0.02,
    lng: initialCity.lng - 0.015,
  });
  const [target, setTarget] = useState<Target>("pickup");
  const [senderName, setSenderName] = useState(initialName);
  const [senderPhone, setSenderPhone] = useState(initialPhone);
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [size, setSize] = useState<ParcelSize>("small");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const distanceKm = useMemo(
    () => parcelDistance(pickup, dropoff),
    [pickup, dropoff],
  );
  const fare = estimateParcelFare(size, distanceKm);
  const active = parcels.filter(
    (parcel) => !["delivered", "cancelled"].includes(parcel.status),
  );
  const history = parcels.filter((parcel) =>
    ["delivered", "cancelled"].includes(parcel.status),
  );

  function changeCity(next: string) {
    const city = cities.find((entry) => entry.slug === next);
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

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError(t("Location is not available in this browser."));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPickup({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setPickupLabel(t("Current location"));
        setLocating(false);
      },
      () => {
        setError(t("Location permission was denied. Move the pin manually."));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/express", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          citySlug,
          customerName: senderName,
          customerPhone: senderPhone,
          pickupLabel,
          pickupLat: pickup.lat,
          pickupLng: pickup.lng,
          dropoffLabel,
          dropoffLat: dropoff.lat,
          dropoffLng: dropoff.lng,
          recipientName,
          recipientPhone,
          size,
          description,
          notes,
        }),
      });
      const data = (await response.json()) as {
        parcel?: ParcelDelivery;
        error?: string;
      };
      if (!response.ok || !data.parcel) {
        setError(data.error || t("Could not book the parcel."));
        return;
      }
      setParcels((current) => [data.parcel!, ...current]);
      setSuccess(t("Parcel {code} booked.", { code: data.parcel.code }));
      setPickupLabel("");
      setDropoffLabel("");
      setRecipientName("");
      setRecipientPhone("");
      setDescription("");
      setNotes("");
    } catch {
      setError(t("Could not book the parcel."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {active.length ? (
        <section className="grid gap-3 lg:grid-cols-2">
          {active.map((parcel) => (
            <Link
              key={parcel.id}
              href={`/express/${parcel.id}`}
              className="aero-tile group rounded-[10px] border p-4 transition-colors hover:border-line-strong"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    <Truck size={12} className="text-brand" />
                    {t(PARCEL_STATUS_TEXT[parcel.status])}
                  </div>
                  <div className="mt-1 font-display text-[19px] font-semibold">
                    {parcel.code}
                  </div>
                  <div className="mt-1 truncate text-[12px] text-muted">
                    {parcel.pickupLabel} → {parcel.dropoffLabel}
                  </div>
                </div>
                <span className="shrink-0 text-[13px] font-semibold tnum">
                  {money(parcel.fare)}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-muted">
                <span>
                  {t("Recipient")}: {parcel.recipientName}
                </span>
                <span className="inline-flex items-center gap-1 font-medium text-brand">
                  {t("Track parcel")} <ArrowRight size={11} />
                </span>
              </div>
            </Link>
          ))}
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <div className="aero-tile overflow-hidden rounded-[10px] border p-2">
          <MapView
            points={[
              {
                id: "pickup",
                lat: pickup.lat,
                lng: pickup.lng,
                kind: "pickup",
                label: pickupLabel || t("Pickup"),
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
            zoom={13}
            height={380}
            onPick={pick}
            className="rounded-[7px]"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-2 text-[11px] text-muted">
            <span>
              {t("Tap the map to set")}{" "}
              <strong className="text-ink">
                {target === "pickup" ? t("pickup") : t("drop-off")}
              </strong>
            </span>
            <button
              type="button"
              onClick={useMyLocation}
              disabled={locating}
              className="btn btn-ghost btn-sm"
            >
              {locating ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <LocateFixed size={12} />
              )}
              {t("Use my location")}
            </button>
          </div>
        </div>

        <form onSubmit={submit} className="aero-tile rounded-[10px] border p-5">
          <div className="flex items-center gap-2">
            <Package size={17} className="text-brand" />
            <h1 className="text-[16px] font-semibold">{t("Send a parcel")}</h1>
          </div>
          <p className="mt-1 text-[11px] leading-5 text-muted">
            {t("Documents and packages across the city. Cash to the driver on delivery.")}
          </p>

          <label className="mt-4 block">
            <span className="label">{t("City")}</span>
            <select
              value={citySlug}
              onChange={(event) => changeCity(event.target.value)}
              className="input"
            >
              {cities.map((city) => (
                <option key={city.slug} value={city.slug}>
                  {city.name}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label">{t("Your name")}</span>
              <input
                value={senderName}
                onChange={(event) => setSenderName(event.target.value)}
                className="input"
                required
              />
            </label>
            <label className="block">
              <span className="label">{t("Your phone")}</span>
              <input
                value={senderPhone}
                onChange={(event) => setSenderPhone(event.target.value)}
                className="input"
                inputMode="tel"
                required
              />
            </label>
          </div>

          <label className="mt-3 block">
            <span className="label">{t("Pickup point")}</span>
            <input
              value={pickupLabel}
              onChange={(event) => setPickupLabel(event.target.value)}
              className="input"
              placeholder={t("e.g. Avenue Mohammed V, building 12")}
              required
            />
          </label>
          <label className="mt-3 block">
            <span className="label">{t("Drop-off point")}</span>
            <input
              value={dropoffLabel}
              onChange={(event) => setDropoffLabel(event.target.value)}
              className="input"
              placeholder={t("e.g. Corniche, Hotel Sahara")}
              required
            />
          </label>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label">{t("Recipient name")}</span>
              <input
                value={recipientName}
                onChange={(event) => setRecipientName(event.target.value)}
                className="input"
                required
              />
            </label>
            <label className="block">
              <span className="label">{t("Recipient phone")}</span>
              <input
                value={recipientPhone}
                onChange={(event) => setRecipientPhone(event.target.value)}
                className="input"
                inputMode="tel"
                required
              />
            </label>
          </div>

          <label className="mt-3 block">
            <span className="label">{t("Package size")}</span>
            <select
              value={size}
              onChange={(event) => setSize(event.target.value as ParcelSize)}
              className="input"
            >
              {PARCEL_SIZES.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {t(entry.label)} · {t(entry.description)}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-3 block">
            <span className="label">{t("What is inside?")}</span>
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="input"
              placeholder={t("e.g. Documents in a sealed envelope")}
            />
          </label>
          <label className="mt-3 block">
            <span className="label">{t("Notes for the driver")}</span>
            <input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="input"
            />
          </label>

          <dl className="mt-4 grid grid-cols-2 gap-3 border-y border-line py-3 text-[12px]">
            <div>
              <dt className="text-[10px] text-muted">{t("Distance")}</dt>
              <dd className="mt-0.5 font-semibold tnum">{distanceKm.toFixed(1)} km</dd>
            </div>
            <div>
              <dt className="text-[10px] text-muted">{t("Cash fare")}</dt>
              <dd className="mt-0.5 font-semibold tnum">{money(fare)}</dd>
            </div>
          </dl>

          {error ? (
            <p className="mt-3 rounded-[6px] bg-danger-soft px-3 py-2 text-[11px] text-danger">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-[6px] bg-success-soft px-3 py-2 text-[11px] font-medium text-success">
              <CheckCircle2 size={12} /> {success}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary mt-4 w-full disabled:opacity-40"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Truck size={14} />}
            {loading ? t("Booking…") : t("Book parcel · {fare}", { fare: money(fare) })}
          </button>
          <div className="mt-3 flex items-center justify-between text-[10px] text-muted">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck size={11} /> {t("Pickup and delivery codes")}
            </span>
            <span>{t("Max 80 km")}</span>
          </div>
        </form>
      </div>

      {history.length ? (
        <section className="overflow-hidden aero-tile rounded-[10px] border">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3 text-[12px] font-semibold">
            <Clock3 size={13} className="text-muted" /> {t("Parcel history")}
          </div>
          <div className="divide-y divide-line">
            {history.map((parcel) => (
              <Link
                key={parcel.id}
                href={`/express/${parcel.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 text-[12px] hover:bg-surface-2"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    {parcel.pickupLabel} → {parcel.dropoffLabel}
                  </span>
                  <span className="text-[10px] text-muted">
                    {parcel.code} · {new Date(parcel.createdAt).toLocaleDateString()}
                  </span>
                </span>
                <span className="shrink-0 text-end">
                  <span className="block font-semibold tnum">{money(parcel.fare)}</span>
                  <span className="text-[10px] text-muted">{t(PARCEL_STATUS_TEXT[parcel.status])}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
