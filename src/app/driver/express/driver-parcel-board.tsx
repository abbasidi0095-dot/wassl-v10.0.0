"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Package,
  Truck,
} from "lucide-react";
import type { ParcelDelivery } from "@/lib/types";

type DriverParcel = Omit<ParcelDelivery, "pickupCode" | "deliveryCode">;
import { PARCEL_STATUS_TEXT } from "@/lib/express";
import { money } from "@/lib/utils";
import { useI18n } from "@/components/locale-provider";

export type ParcelQueueItem = {
  id: string;
  code: string;
  pickupLabel: string;
  dropoffLabel: string;
  distanceKm: number;
  fare: number;
  size: string;
  createdAt: string;
};

export function DriverParcelBoard({
  initialAssigned,
  initialQueue,
}: {
  initialAssigned: DriverParcel[];
  initialQueue: ParcelQueueItem[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [assigned, setAssigned] = useState<DriverParcel[]>(initialAssigned);
  const [queue, setQueue] = useState(initialQueue);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 12_000);
    return () => window.clearInterval(timer);
  }, [router]);

  async function move(
    parcel: DriverParcel,
    status: "picked_up" | "in_transit" | "delivered",
    proofCode?: string,
  ) {
    setBusy(parcel.id);
    setError("");
    try {
      const response = await fetch(`/api/express/${parcel.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, proofCode }),
      });
      const data = (await response.json()) as {
        parcel?: ParcelDelivery;
        error?: string;
      };
      if (!response.ok || !data.parcel) {
        setError(data.error || t("Could not update the parcel."));
        return;
      }
      setAssigned((current) =>
        current.map((entry) => (entry.id === data.parcel!.id ? data.parcel! : entry)),
      );
      router.refresh();
    } finally {
      setBusy("");
    }
  }

  async function accept(item: ParcelQueueItem) {
    setBusy(item.id);
    setError("");
    try {
      const response = await fetch(`/api/express/${item.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "accepted" }),
      });
      const data = (await response.json()) as {
        parcel?: ParcelDelivery;
        error?: string;
      };
      if (!response.ok || !data.parcel) {
        setError(data.error || t("Could not accept the parcel."));
        return;
      }
      setQueue((current) => current.filter((entry) => entry.id !== item.id));
      setAssigned((current) => [data.parcel!, ...current]);
      router.refresh();
    } finally {
      setBusy("");
    }
  }

  function pickup(parcel: DriverParcel) {
    const code = window.prompt(t("Enter the sender's 4-digit pickup code"));
    if (code) void move(parcel, "picked_up", code);
  }

  function deliver(parcel: DriverParcel) {
    const code = window.prompt(t("Enter the recipient's 4-digit delivery code"));
    if (code) void move(parcel, "delivered", code);
  }

  return (
    <div className="space-y-5">
      {error ? (
        <p className="rounded-[6px] bg-danger-soft px-3 py-2 text-[12px] text-danger">
          {error}
        </p>
      ) : null}

      <section>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[13px] font-semibold">{t("My parcels")}</h2>
          <span className="pill">{assigned.length}</span>
        </div>
        <div className="mt-3 space-y-3">
          {assigned.map((parcel) => (
            <article key={parcel.id} className="aero-tile rounded-[10px] border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    <Truck size={12} className="text-brand" />
                    {t(PARCEL_STATUS_TEXT[parcel.status])}
                  </div>
                  <div className="mt-1 font-display text-[20px] font-semibold">
                    {parcel.code}
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
              <div className="mt-3 rounded-[6px] bg-surface-2 p-3 text-[11px]">
                <div className="font-semibold">{parcel.recipientName}</div>
                <div className="text-muted">{parcel.recipientPhone}</div>
                {parcel.description ? (
                  <div className="mt-1 text-muted">{parcel.description}</div>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {parcel.status === "accepted" ? (
                  <button
                    type="button"
                    onClick={() => pickup(parcel)}
                    disabled={busy === parcel.id}
                    className="btn btn-primary btn-sm disabled:opacity-40"
                  >
                    {busy === parcel.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Package size={12} />
                    )}
                    {t("Confirm collection")}
                  </button>
                ) : null}
                {parcel.status === "picked_up" ? (
                  <button
                    type="button"
                    onClick={() => void move(parcel, "in_transit")}
                    disabled={busy === parcel.id}
                    className="btn btn-primary btn-sm disabled:opacity-40"
                  >
                    {t("Start delivery")} <ArrowRight size={12} />
                  </button>
                ) : null}
                {parcel.status === "in_transit" ? (
                  <button
                    type="button"
                    onClick={() => deliver(parcel)}
                    disabled={busy === parcel.id}
                    className="btn btn-primary btn-sm disabled:opacity-40"
                  >
                    {busy === parcel.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={12} />
                    )}
                    {t("Complete handover")}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
          {!assigned.length ? (
            <div className="rounded-[8px] border border-dashed border-line px-4 py-8 text-center text-[11px] text-muted">
              {t("No parcels assigned right now.")}
            </div>
          ) : null}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[13px] font-semibold">{t("Nearby parcel requests")}</h2>
          <span className="pill">{queue.length}</span>
        </div>
        <div className="mt-3 grid gap-2">
          {queue.map((item) => (
            <div
              key={item.id}
              className="aero-tile flex flex-wrap items-center justify-between gap-3 rounded-[8px] border p-3"
            >
              <div className="min-w-0">
                <div className="text-[12px] font-semibold">{item.code}</div>
                <div className="truncate text-[11px] text-muted">
                  {item.pickupLabel} → {item.dropoffLabel}
                </div>
                <div className="text-[10px] text-muted">
                  {item.size} · {item.distanceKm.toFixed(1)} km
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[13px] font-semibold tnum">{money(item.fare)}</span>
                <button
                  type="button"
                  onClick={() => void accept(item)}
                  disabled={busy === item.id}
                  className="btn btn-primary btn-sm disabled:opacity-40"
                >
                  {busy === item.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : null}
                  {t("Accept")}
                </button>
              </div>
            </div>
          ))}
          {!queue.length ? (
            <div className="rounded-[8px] border border-dashed border-line px-4 py-8 text-center text-[11px] text-muted">
              {t("No parcel requests in your city right now.")}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
