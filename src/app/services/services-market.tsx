"use client";

import { useMemo, useState } from "react";
import {
  BrushCleaning,
  CheckCircle2,
  Loader2,
  MapPin,
  Phone,
  Sparkles,
  Wrench,
} from "lucide-react";
import type { ServiceBooking, ServiceProvider } from "@/lib/types";
import {
  SERVICE_CATEGORIES,
  SERVICE_SLOTS,
  SERVICE_STATUS_TEXT,
} from "@/lib/services";
import { money } from "@/lib/utils";
import { useI18n } from "@/components/locale-provider";

export function ServicesMarket({
  providers,
  initialBookings,
}: {
  providers: ServiceProvider[];
  initialBookings: ServiceBooking[];
}) {
  const { t } = useI18n();
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<ServiceProvider | null>(null);
  const [bookings, setBookings] = useState(initialBookings);
  const [service, setService] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [landmark, setLandmark] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("09:00");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const visible = useMemo(
    () =>
      providers.filter((provider) =>
        category === "all" ? true : provider.category === category,
      ),
    [providers, category],
  );

  async function book(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/services/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: selected.id,
          service,
          description,
          address,
          landmark,
          date,
          slot,
        }),
      });
      const data = (await response.json()) as {
        booking?: ServiceBooking;
        error?: string;
      };
      if (!response.ok || !data.booking) {
        setError(data.error || t("Could not request the booking."));
        return;
      }
      setBookings((current) => [data.booking!, ...current]);
      setSuccess(t("Request sent to {provider}.", { provider: selected.name }));
      setSelected(null);
      setService("");
      setDescription("");
      setAddress("");
      setLandmark("");
      setDate("");
    } catch {
      setError(t("Could not request the booking."));
    } finally {
      setLoading(false);
    }
  }

  async function cancel(booking: ServiceBooking) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/services/bookings/${booking.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      const data = (await response.json()) as {
        booking?: ServiceBooking;
        error?: string;
      };
      if (!response.ok || !data.booking) {
        setError(data.error || t("Could not cancel the booking."));
        return;
      }
      setBookings((current) =>
        current.map((entry) => (entry.id === data.booking!.id ? data.booking! : entry)),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setCategory("all")}
          className={`rounded-full px-3 py-1.5 text-[11px] font-medium ${
            category === "all" ? "bg-ink text-on-dark" : "border border-line text-muted"
          }`}
        >
          {t("All services")}
        </button>
        {SERVICE_CATEGORIES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setCategory(entry.id)}
            className={`rounded-full px-3 py-1.5 text-[11px] font-medium ${
              category === entry.id
                ? "bg-ink text-on-dark"
                : "border border-line text-muted"
            }`}
          >
            {t(entry.label)}
          </button>
        ))}
      </div>

      {success ? (
        <p className="inline-flex items-center gap-1.5 rounded-[6px] bg-success-soft px-3 py-2 text-[11px] text-success">
          <CheckCircle2 size={12} /> {success}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-[6px] bg-danger-soft px-3 py-2 text-[11px] text-danger">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((provider) => (
          <article key={provider.id} className="aero-tile rounded-[10px] border p-4">
            <div className="flex items-start justify-between gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-[7px] bg-brand-soft text-brand">
                {provider.category === "cleaning" ? (
                  <BrushCleaning size={18} />
                ) : provider.category === "plumbing" || provider.category === "electrical" ? (
                  <Wrench size={18} />
                ) : (
                  <Sparkles size={18} />
                )}
              </span>
              <span className="text-[10px] text-muted tnum">
                {provider.rating > 0 ? provider.rating.toFixed(1) : "New"} ·{" "}
                {provider.reviews} {t("reviews")}
              </span>
            </div>
            <h3 className="mt-3 text-[14px] font-semibold">{provider.name}</h3>
            <p className="mt-1 text-[11px] leading-5 text-muted">{provider.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-muted">
              <span className="rounded-[2px] bg-surface-2 px-1.5 py-0.5">
                {t(
                  SERVICE_CATEGORIES.find((entry) => entry.id === provider.category)?.label ??
                    "Other",
                )}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin size={10} /> {provider.address}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
              <span className="text-[12px] font-semibold tnum">
                {t("From {price}", { price: money(provider.priceFrom) })}
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelected(provider);
                  setSuccess("");
                  setError("");
                }}
                className="btn btn-primary btn-sm"
              >
                {t("Request")}
              </button>
            </div>
          </article>
        ))}
      </div>

      {selected ? (
        <form onSubmit={book} className="aero-tile rounded-[10px] border p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold">
                {t("Book {provider}", { provider: selected.name })}
              </h2>
              <p className="mt-1 text-[11px] text-muted">{selected.description}</p>
            </div>
            <a
              href={`tel:${selected.phone.replace(/\s/g, "")}`}
              className="btn btn-ghost btn-sm"
            >
              <Phone size={12} /> {t("Call")}
            </a>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label">{t("Service")}</span>
              <input
                value={service}
                onChange={(event) => setService(event.target.value)}
                className="input"
                placeholder={t("e.g. Wash and fold")}
                required
              />
            </label>
            <label className="block">
              <span className="label">{t("Date")}</span>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="input"
                required
              />
            </label>
            <label className="block">
              <span className="label">{t("Time")}</span>
              <select
                value={slot}
                onChange={(event) => setSlot(event.target.value)}
                className="input"
              >
                {SERVICE_SLOTS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">{t("Address")}</span>
              <input
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                className="input"
                required
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="label">{t("Landmark")}</span>
              <input
                value={landmark}
                onChange={(event) => setLandmark(event.target.value)}
                className="input"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="label">{t("Describe the job")}</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="input min-h-24"
                required
              />
            </label>
          </div>
          <p className="mt-2 text-[10px] text-muted">
            {t("The provider confirms before the appointment is booked. Pay cash on completion.")}
          </p>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => setSelected(null)} className="btn btn-ghost flex-1">
              {t("Cancel")}
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary flex-1 disabled:opacity-40">
              {loading ? <Loader2 size={13} className="animate-spin" /> : null}
              {t("Send request")}
            </button>
          </div>
        </form>
      ) : null}

      <section>
        <h2 className="text-[13px] font-semibold">{t("My service bookings")}</h2>
        <div className="mt-3 space-y-2">
          {bookings.map((booking) => {
            const provider = providers.find((entry) => entry.id === booking.providerId);
            return (
              <div key={booking.id} className="aero-tile rounded-[8px] border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[12px] font-semibold">
                      {booking.code} · {booking.service}
                    </div>
                    <div className="text-[10px] text-muted">
                      {provider?.name} · {booking.date} {booking.slot}
                    </div>
                  </div>
                  <span className="pill">{t(SERVICE_STATUS_TEXT[booking.status])}</span>
                </div>
                {booking.status === "requested" ? (
                  <button
                    type="button"
                    onClick={() => void cancel(booking)}
                    disabled={loading}
                    className="mt-2 text-[10px] font-medium text-danger"
                  >
                    {t("Cancel request")}
                  </button>
                ) : null}
              </div>
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
