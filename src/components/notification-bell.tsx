"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Bell,
  BellRing,
  CheckCheck,
  Loader2,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useLiveActivity } from "./live-activity-provider";
import { useI18n } from "./locale-provider";
import { timeAgo } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const {
    notifications,
    unread,
    pushState,
    pushError,
    markAllRead,
    clearNotifications,
    enablePush,
    sendTest,
  } = useLiveActivity();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tested, setTested] = useState<number | null>(null);
  const [scheduled, setScheduled] = useState(false);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => markAllRead(), 900);
    return () => window.clearTimeout(timer);
  }, [open, markAllRead]);

  async function turnOn() {
    setBusy(true);
    try {
      await enablePush();
    } finally {
      setBusy(false);
    }
  }

  async function test(delaySeconds = 0) {
    setBusy(true);
    setTested(null);
    setScheduled(delaySeconds > 0);
    try {
      setTested(await sendTest(delaySeconds));
    } finally {
      setScheduled(false);
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative grid h-9 w-9 place-items-center rounded-[6px] text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        aria-label={t("Notifications")}
        aria-expanded={open}
      >
        {unread ? <BellRing size={18} /> : <Bell size={18} />}
        {unread ? (
          <span className="absolute -end-0.5 -top-0.5 grid h-[15px] min-w-[15px] place-items-center rounded-full bg-signal px-1 text-[11px] font-semibold text-[#fffaf1]">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label={t("Close")}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="fixed end-2 top-[calc(64px+env(safe-area-inset-top))] z-50 w-[min(92vw,360px)] overflow-hidden rounded-[8px] border border-line bg-surface shadow-[0_18px_40px_-24px_rgba(12,26,23,.45)] sm:absolute sm:end-0 sm:top-11">
            <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
              <div>
                <div className="text-[13px] font-semibold">{t("Notifications")}</div>
                <div className="text-[11px] text-muted">
                  {pushError
                    ? t("Alerts need attention")
                    : pushState === "subscribed" || pushState === "granted"
                      ? t("Live updates are on")
                      : t("Turn on alerts for orders and rides")}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-[4px] text-muted hover:bg-surface-2 hover:text-ink"
                aria-label={t("Close")}
              >
                <X size={15} />
              </button>
            </div>

            <div className="max-h-[46vh] overflow-y-auto">
              {notifications.length ? (
                notifications.map((item) => (
                  <Link
                    key={item.id}
                    href={item.url}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex gap-2.5 border-b border-line px-4 py-3 transition-colors hover:bg-surface-2",
                      !item.read && "bg-brand-soft/40",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1 h-2 w-2 shrink-0 rounded-full",
                        item.kind === "taxi" ? "bg-signal" : "bg-brand",
                      )}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold">
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-4 text-muted">
                        {item.body}
                      </span>
                      <span className="mt-1 block text-[11px] font-bold uppercase tracking-wider text-muted">
                        {timeAgo(item.at)}
                      </span>
                    </span>
                  </Link>
                ))
              ) : (
                <div className="px-4 py-10 text-center text-[13px] text-muted">
                  {t("No notifications yet")}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-line bg-surface px-3 py-2">
              <button
                type="button"
                onClick={turnOn}
                disabled={busy}
                className={cn(
                  "btn btn-sm",
                  pushState === "subscribed" || pushState === "granted"
                    ? "btn-ghost"
                    : "btn-primary",
                )}
              >
                {busy ? <Loader2 size={13} className="animate-spin" /> : <BellRing size={13} />}
                {pushState === "subscribed" || pushState === "granted"
                  ? t("Alerts on")
                  : pushState === "denied"
                    ? t("Alerts blocked")
                    : t("Enable alerts")}
              </button>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void test(0)}
                  disabled={busy}
                  className="btn btn-ghost btn-sm"
                  title={t("Send a test notification")}
                >
                  <Send size={13} />
                  {tested === null ? t("Test") : `${tested}`}
                </button>
                <button
                  type="button"
                  onClick={() => void test(10)}
                  disabled={busy}
                  className="btn btn-ghost btn-sm px-2"
                  title={t(
                    "Send the test after 10 seconds so you can lock the phone",
                  )}
                >
                  10s
                </button>
                <button
                  type="button"
                  onClick={markAllRead}
                  className="grid h-8 w-8 place-items-center rounded-[4px] text-muted hover:bg-surface-2 hover:text-ink"
                  aria-label={t("Mark all read")}
                >
                  <CheckCheck size={14} />
                </button>
                <button
                  type="button"
                  onClick={clearNotifications}
                  className="grid h-8 w-8 place-items-center rounded-[6px] text-muted hover:bg-surface-2 hover:text-danger"
                  aria-label={t("Clear notifications")}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {pushState === "unsupported" ? (
              <p className="border-t border-line px-4 py-2 text-[11px] font-bold text-muted">
                {t("This browser does not support web notifications.")}
              </p>
            ) : null}
            {pushError && tested === null ? (
              <p className="border-t border-line px-4 py-2 text-[11px] leading-4 text-danger">
                {pushError}
              </p>
            ) : null}
            {pushState === "denied" ? (
              <p className="border-t border-line px-4 py-2 text-[11px] font-bold text-muted">
                {t("Allow notifications in your browser settings to receive alerts.")}
              </p>
            ) : null}
            {scheduled ? (
              <p className="border-t border-line px-4 py-2 text-[11px] leading-4 text-brand">
                {t(
                  "Test scheduled. Lock your phone now and check Notification Center in 10 seconds.",
                )}
              </p>
            ) : null}
            {tested !== null ? (
              <p
                className={cn(
                  "border-t border-line px-4 py-2 text-[11px] leading-4",
                  tested > 0 ? "text-muted" : "text-danger",
                )}
              >
                {tested > 0
                  ? t(
                      "Server delivered the test to {count} device(s). If no banner appears, check iOS Settings → Notifications → Wassl and allow Lock Screen, Notification Center and Banners.",
                      { count: tested },
                    )
                  : pushError ||
                    t(
                      "No push subscription yet. Tap Enable alerts, allow notifications, then test again. On iOS also check Settings → Notifications → Wassl.",
                    )}
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
