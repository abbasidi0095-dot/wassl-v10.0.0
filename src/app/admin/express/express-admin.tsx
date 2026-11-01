"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Loader2, Truck, X } from "lucide-react";
import type { Driver, ParcelDelivery } from "@/lib/types";
import { PARCEL_STATUS_TEXT } from "@/lib/express";
import { money, timeAgo } from "@/lib/utils";
import { useI18n } from "@/components/locale-provider";

export function ExpressAdmin({
  initialParcels,
  drivers,
}: {
  initialParcels: ParcelDelivery[];
  drivers: Driver[];
}) {
  const { t } = useI18n();
  const [parcels, setParcels] = useState(initialParcels);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"active" | "all" | "done">("active");

  const visible = parcels.filter((parcel) =>
    filter === "all"
      ? true
      : filter === "done"
        ? ["delivered", "cancelled"].includes(parcel.status)
        : !["delivered", "cancelled"].includes(parcel.status),
  );

  async function assign(parcel: ParcelDelivery, driverId: string) {
    if (!driverId) return;
    setBusy(parcel.id);
    setError("");
    try {
      const response = await fetch(`/api/express/${parcel.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId }),
      });
      const data = (await response.json()) as {
        parcel?: ParcelDelivery;
        error?: string;
      };
      if (!response.ok || !data.parcel) {
        setError(data.error || t("Could not assign the parcel."));
        return;
      }
      setParcels((current) =>
        current.map((entry) => (entry.id === data.parcel!.id ? data.parcel! : entry)),
      );
    } finally {
      setBusy("");
    }
  }

  async function cancel(parcel: ParcelDelivery) {
    if (!window.confirm(t("Cancel parcel {code}?", { code: parcel.code }))) return;
    setBusy(parcel.id);
    setError("");
    try {
      const response = await fetch(`/api/express/${parcel.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      const data = (await response.json()) as {
        parcel?: ParcelDelivery;
        error?: string;
      };
      if (!response.ok || !data.parcel) {
        setError(data.error || t("Could not cancel the parcel."));
        return;
      }
      setParcels((current) =>
        current.map((entry) => (entry.id === data.parcel!.id ? data.parcel! : entry)),
      );
    } finally {
      setBusy("");
    }
  }

  const availableDrivers = drivers.filter(
    (driver) => driver.active && driver.kind !== "taxi",
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="display text-[clamp(2rem,1.5rem+2vw,3rem)]">
            {t("Express operations")}
          </h1>
          <p className="mt-1 text-[12px] text-muted">
            {t("Parcel assignment, handover codes and incidents.")}
          </p>
        </div>
        <div className="flex gap-1">
          {(["active", "all", "done"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-[4px] px-2.5 py-1.5 text-[11px] font-semibold capitalize ${
                filter === value ? "bg-ink text-on-dark" : "text-muted hover:text-ink"
              }`}
            >
              {t(value)}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="mt-3 rounded-[6px] bg-danger-soft px-3 py-2 text-[12px] text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-4 space-y-3">
        {visible.map((parcel) => (
          <article key={parcel.id} className="aero-tile rounded-[10px] border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                  <Truck size={12} className="text-brand" />
                  {t(PARCEL_STATUS_TEXT[parcel.status])}
                  <span className="text-line-strong">/</span>
                  {timeAgo(parcel.createdAt)}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Link
                    href={`/express/${parcel.id}`}
                    className="font-display text-[18px] font-semibold hover:text-brand"
                  >
                    {parcel.code}
                  </Link>
                  <span className="text-[11px] text-muted">{parcel.citySlug}</span>
                </div>
                <div className="mt-1 text-[12px] text-muted">
                  {parcel.pickupLabel} → {parcel.dropoffLabel}
                </div>
              </div>
              <div className="text-end">
                <div className="text-[15px] font-semibold tnum">{money(parcel.fare)}</div>
                <div className="text-[10px] text-muted">{parcel.distanceKm.toFixed(1)} km</div>
              </div>
            </div>

            <div className="mt-3 grid gap-2 rounded-[6px] bg-surface-2 p-3 text-[11px] sm:grid-cols-2">
              <div>
                <div className="font-semibold">{parcel.customerName}</div>
                <div className="text-muted">{parcel.customerPhone}</div>
              </div>
              <div>
                <div className="font-semibold">{parcel.recipientName}</div>
                <div className="text-muted">{parcel.recipientPhone}</div>
              </div>
              <div>
                <span className="text-muted">{t("Pickup code")}: </span>
                <span className="font-semibold tnum">{parcel.pickupCode}</span>
              </div>
              <div>
                <span className="text-muted">{t("Delivery code")}: </span>
                <span className="font-semibold tnum">{parcel.deliveryCode}</span>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {parcel.status === "requested" ? (
                <select
                  aria-label={t("Assign driver for {code}", { code: parcel.code })}
                  onChange={(event) => void assign(parcel, event.target.value)}
                  defaultValue=""
                  disabled={busy === parcel.id}
                  className="h-8 rounded-[5px] border border-line bg-surface px-2 text-[11px]"
                >
                  <option value="">{t("Assign a driver…")}</option>
                  {availableDrivers
                    .filter((driver) => driver.citySlug === parcel.citySlug)
                    .map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.name} · {driver.vehicle}
                      </option>
                    ))}
                </select>
              ) : parcel.driverName ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                  <CheckCircle2 size={11} className="text-success" />
                  {parcel.driverName} · {parcel.driverPhone}
                </span>
              ) : null}
              {!["delivered", "cancelled"].includes(parcel.status) ? (
                <button
                  type="button"
                  onClick={() => void cancel(parcel)}
                  disabled={busy === parcel.id}
                  className="btn btn-ghost btn-sm text-danger"
                >
                  {busy === parcel.id ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <X size={11} />
                  )}
                  {t("Cancel")}
                </button>
              ) : null}
              <Link
                href={`/express/${parcel.id}`}
                className="ms-auto text-[11px] font-medium text-brand"
              >
                {t("Open parcel")}
              </Link>
            </div>
          </article>
        ))}
        {!visible.length ? (
          <div className="rounded-[8px] border border-dashed border-line px-5 py-12 text-center text-[12px] text-muted">
            {t("No parcels in this view.")}
          </div>
        ) : null}
      </div>
    </div>
  );
}
