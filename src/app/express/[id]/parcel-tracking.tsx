"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Loader2,
  MapPin,
  Package,
  ShieldCheck,
  Truck,
  UserRound,
} from "lucide-react";
import type { ParcelDelivery } from "@/lib/types";
import { PARCEL_STATUS_TEXT } from "@/lib/express";
import { money } from "@/lib/utils";
import { useI18n } from "@/components/locale-provider";
import { HandoverCode } from "@/components/handover-code";
import { StartChatButton } from "@/components/start-chat-button";

const STEPS = ["requested", "accepted", "picked_up", "in_transit", "delivered"] as const;

export function ParcelTracking({
  initial,
  role,
}: {
  initial: ParcelDelivery;
  role: "customer" | "admin" | "driver";
}) {
  const { t } = useI18n();
  const [parcel, setParcel] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cancelled = parcel.status === "cancelled";
  const currentIndex = STEPS.findIndex((step) => step === parcel.status);

  async function cancel() {
    if (!window.confirm(t("Cancel this parcel?"))) return;
    setBusy(true);
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
      setParcel(data.parcel);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr] lg:items-start">
      <div>
        <Link
          href={role === "admin" ? "/admin/express" : "/express"}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted hover:text-ink"
        >
          <ArrowLeft size={12} className="rtl:-scale-x-100" />
          {role === "admin" ? t("Parcel operations") : t("Wassl Express")}
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
              <Truck size={12} className="text-brand" />
              {t(PARCEL_STATUS_TEXT[parcel.status])}
            </div>
            <h1 className="display mt-1 text-[clamp(2rem,1.5rem+2vw,3rem)]">
              {parcel.code}
            </h1>
            <p className="mt-1 text-[12px] text-muted">
              {parcel.pickupLabel} → {parcel.dropoffLabel}
            </p>
          </div>
          <div className="text-end">
            <div className="text-[22px] font-semibold tnum">{money(parcel.fare)}</div>
            <div className="text-[10px] text-muted">{t("Cash on delivery")}</div>
          </div>
        </div>

        <section className="aero-tile mt-5 rounded-[10px] border p-4">
          <ol className="space-y-3">
            {STEPS.map((step, index) => {
              const done = cancelled ? false : index <= currentIndex;
              const active = !cancelled && index === currentIndex;
              return (
                <li key={step} className="flex items-center gap-3">
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
                      done
                        ? "border-brand bg-brand text-on-dark"
                        : "border-line text-muted"
                    }`}
                  >
                    {done ? <CheckCircle2 size={12} /> : <span className="text-[9px]">{index + 1}</span>}
                  </span>
                  <span className={`text-[12px] ${active ? "font-semibold" : "text-muted"}`}>
                    {t(PARCEL_STATUS_TEXT[step])}
                  </span>
                </li>
              );
            })}
            {cancelled ? (
              <li className="flex items-center gap-3 text-[12px] font-semibold text-danger">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-danger-soft">
                  ×
                </span>
                {t("Cancelled")}
              </li>
            ) : null}
          </ol>
        </section>

        {role !== "driver" && !cancelled ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <HandoverCode
              code={parcel.pickupCode}
              label={t("Pickup code")}
              note={t("Give this to the driver when they collect the parcel.")}
            />
            <HandoverCode
              code={parcel.deliveryCode}
              label={t("Recipient delivery code")}
              note={t("Share this with the recipient for handover.")}
            />
          </div>
        ) : null}

        <section className="aero-tile mt-4 rounded-[10px] border p-4">
          <div className="flex items-center gap-2 text-[12px] font-semibold">
            <Package size={14} className="text-brand" /> {t("Parcel details")}
          </div>
          <dl className="mt-3 grid gap-3 text-[12px] sm:grid-cols-2">
            <div>
              <dt className="text-[10px] text-muted">{t("Recipient")}</dt>
              <dd className="mt-0.5 font-medium">{parcel.recipientName}</dd>
              <dd className="text-[11px] text-muted">{parcel.recipientPhone}</dd>
            </div>
            <div>
              <dt className="text-[10px] text-muted">{t("Size")}</dt>
              <dd className="mt-0.5 font-medium capitalize">{t(parcel.size)}</dd>
            </div>
            <div>
              <dt className="text-[10px] text-muted">{t("Distance")}</dt>
              <dd className="mt-0.5 font-medium tnum">{parcel.distanceKm.toFixed(1)} km</dd>
            </div>
            <div>
              <dt className="text-[10px] text-muted">{t("Created")}</dt>
              <dd className="mt-0.5 font-medium">
                {new Date(parcel.createdAt).toLocaleString()}
              </dd>
            </div>
            {parcel.description ? (
              <div className="sm:col-span-2">
                <dt className="text-[10px] text-muted">{t("Contents")}</dt>
                <dd className="mt-0.5">{parcel.description}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        {role === "customer" && ["requested", "accepted"].includes(parcel.status) ? (
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className="btn btn-ghost btn-sm mt-4 text-danger"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : null}
            {t("Cancel parcel")}
          </button>
        ) : null}
        {error ? <p className="mt-2 text-[11px] text-danger">{error}</p> : null}
      </div>

      <aside className="space-y-3">
        <div className="aero-tile rounded-[10px] border p-5">
          <div className="flex items-center gap-2 text-[12px] font-semibold">
            <UserRound size={14} className="text-brand" /> {t("Driver")}
          </div>
          {parcel.driverName ? (
            <>
              <div className="mt-2 text-[13px] font-semibold">{parcel.driverName}</div>
              <div className="text-[11px] text-muted">{parcel.driverPhone}</div>
            </>
          ) : (
            <p className="mt-2 text-[12px] text-muted">
              {t("We are matching this parcel with a driver.")}
            </p>
          )}
        </div>
        <div className="aero-tile rounded-[10px] border p-5 text-[11px] leading-5 text-muted">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-ink">
            <ShieldCheck size={14} className="text-brand" /> {t("Protected handover")}
          </div>
          <p className="mt-2">
            {t("The driver enters the pickup code at collection and the recipient code at delivery. Drivers never see either code in advance.")}
          </p>
        </div>
        <div className="aero-tile rounded-[10px] border p-5">
          <div className="flex items-center gap-2 text-[12px] font-semibold">
            <MapPin size={14} className="text-brand" /> {t("Need help?")}
          </div>
          <div className="mt-3">
            <StartChatButton
              topic="support"
              subject={`Parcel ${parcel.code}`}
              label={t("Message support")}
            />
          </div>
        </div>
        <div className="aero-tile rounded-[10px] border p-5 text-[11px] text-muted">
          <div className="flex items-center gap-1.5">
            <Clock3 size={12} /> {t("Tracking code")}: {parcel.trackingCode}
          </div>
        </div>
      </aside>
    </div>
  );
}
