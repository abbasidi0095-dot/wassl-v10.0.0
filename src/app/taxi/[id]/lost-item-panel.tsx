"use client";

import { useState } from "react";
import { Loader2, PackageSearch } from "lucide-react";
import type { TaxiRide } from "@/lib/types";
import { useI18n } from "@/components/locale-provider";

export function LostItemPanel({
  ride,
  onUpdated,
}: {
  ride: TaxiRide;
  onUpdated: (ride: TaxiRide) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/taxi/rides/${ride.id}/lost`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, contact }),
      });
      const data = (await response.json()) as { ride?: TaxiRide; error?: string };
      if (!response.ok || !data.ride) {
        setError(data.error || t("Could not report the item."));
        return;
      }
      onUpdated(data.ride);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  if (ride.lostItem) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <PackageSearch size={15} className="text-brand" /> {t("Lost item")}
        </div>
        <p className="mt-2 text-[12px] text-muted">{ride.lostItem.description}</p>
        <p className="mt-1 text-[11px] text-muted">
          {t("Status")}: {t(ride.lostItem.status)}
        </p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <PackageSearch size={15} className="text-brand" /> {t("Lost something?")}
        </div>
        {!open ? (
          <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost btn-sm">
            {t("Report")}
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="mt-3 space-y-2">
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="input text-[12px]"
            placeholder={t("What did you leave behind?")}
          />
          <input
            value={contact}
            onChange={(event) => setContact(event.target.value)}
            className="input text-[12px]"
            placeholder={t("Phone or email")}
          />
          {error ? <p className="text-[11px] text-danger">{error}</p> : null}
          <button
            type="button"
            onClick={() => void submit()}
            disabled={loading}
            className="btn btn-primary btn-sm disabled:opacity-40"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : null}
            {t("Send report")}
          </button>
        </div>
      ) : (
        <p className="mt-1 text-[11px] text-muted">
          {t("Report an item left in the taxi after the ride.")}
        </p>
      )}
    </div>
  );
}
