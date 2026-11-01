"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, Gift, Loader2 } from "lucide-react";
import { useI18n } from "@/components/locale-provider";

export function LoyaltyActions({
  referralCode,
  birthday,
  canClaimReferral,
}: {
  referralCode: string;
  birthday?: string;
  canClaimReferral: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [date, setDate] = useState(birthday ?? "");
  const [busy, setBusy] = useState<"referral" | "birthday" | "">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function claimReferral() {
    setBusy("referral");
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/loyalty/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || t("Could not claim the referral"));
        return;
      }
      setMessage(t("Referral claimed. 100 points added to both accounts."));
      setCode("");
      router.refresh();
    } finally {
      setBusy("");
    }
  }

  async function saveBirthday() {
    setBusy("birthday");
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/loyalty/birthday", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ birthday: date }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || t("Could not save the birthday"));
        return;
      }
      setMessage(t("Birthday saved. You get 100 points on the day."));
      router.refresh();
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="aero-tile rounded-[10px] border p-5">
      <div className="flex items-center gap-2">
        <Gift size={16} className="text-brand" />
        <h2 className="text-[13px] font-semibold">{t("Referrals & birthday")}</h2>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="text-[11px] font-semibold">{t("Your referral code")}</div>
          <div className="mt-1 rounded-[6px] border border-line bg-surface-2 px-3 py-2 font-mono text-[13px] font-semibold tracking-[0.08em]">
            {referralCode}
          </div>
          {canClaimReferral ? (
            <>
              <label className="mt-3 block">
                <span className="label">{t("Used a friend's code?")}</span>
                <div className="flex gap-2">
                  <input
                    value={code}
                    onChange={(event) => setCode(event.target.value.toUpperCase())}
                    className="input h-9 flex-1 text-[12px]"
                    placeholder={t("WSL-XXXXXX")}
                  />
                  <button
                    type="button"
                    onClick={() => void claimReferral()}
                    disabled={busy === "referral" || code.trim().length < 4}
                    className="btn btn-primary btn-sm disabled:opacity-40"
                  >
                    {busy === "referral" ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Check size={12} />
                    )}
                    {t("Claim")}
                  </button>
                </div>
              </label>
            </>
          ) : (
            <p className="mt-2 text-[10px] text-muted">
              {t("A referral has already been applied to this account.")}
            </p>
          )}
        </div>

        <div>
          <label className="block">
            <span className="text-[11px] font-semibold">{t("Birthday")}</span>
            <div className="mt-1 flex gap-2">
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="input h-9 flex-1 text-[12px]"
              />
              <button
                type="button"
                onClick={() => void saveBirthday()}
                disabled={busy === "birthday" || !date}
                className="btn btn-ghost btn-sm disabled:opacity-40"
              >
                {busy === "birthday" ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <CalendarDays size={12} />
                )}
                {t("Save")}
              </button>
            </div>
          </label>
          <p className="mt-2 text-[10px] text-muted">
            {t("We add 100 points once a year on your birthday.")}
          </p>
        </div>
      </div>

      {message ? (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-[6px] bg-success-soft px-3 py-2 text-[11px] text-success">
          <Check size={12} /> {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-[6px] bg-danger-soft px-3 py-2 text-[11px] text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}
