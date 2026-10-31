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
    markAllRead,
    clearNotifications,
    enablePush,
    sendTest,
  } = useLiveActivity();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tested, setTested] = useState<number | null>(null);

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

  async function test() {
    setBusy(true);
    try {
      setTested(await sendTest());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative grid h-10 w-10 place-items-center rounded-xl border border-ink/10 bg-white/70 text-ink transition hover:bg-white"
        aria-label={t("Notifications")}
        aria-expanded={open}
      >
        {unread ? <BellRing size={18} /> : <Bell size={18} />}
        {unread ? (
          <span className="absolute -end-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-coral px-1 text-[9px] font-extrabold text-on-dark">
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
          <div className="fixed end-2 top-[calc(70px+env(safe-area-inset-top))] z-50 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-ink/10 bg-paper shadow-2xl sm:absolute sm:end-0 sm:top-12">
            <div className="flex items-center justify-between gap-2 border-b border-ink/8 px-4 py-3">
              <div>
                <div className="text-sm font-extrabold">{t("Notifications")}</div>
                <div className="text-[10px] font-bold text-ink/40">
                  {pushState === "subscribed" || pushState === "granted"
                    ? t("Live updates are on")
                    : t("Turn on alerts for orders and rides")}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg text-ink/40 hover:bg-cream hover:text-ink"
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
                      "flex gap-2.5 border-b border-ink/5 px-4 py-3 transition hover:bg-cream/60",
                      !item.read && "bg-teal/5",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1 h-2 w-2 shrink-0 rounded-full",
                        item.kind === "taxi" ? "bg-saffron" : "bg-teal",
                      )}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-[12px] font-extrabold">
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-4 text-ink/55">
                        {item.body}
                      </span>
                      <span className="mt-1 block text-[9px] font-bold uppercase tracking-wider text-ink/30">
                        {timeAgo(item.at)}
                      </span>
                    </span>
                  </Link>
                ))
              ) : (
                <div className="px-4 py-10 text-center text-xs font-bold text-ink/40">
                  {t("No notifications yet")}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-ink/8 bg-cream/50 px-3 py-2">
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
                  onClick={test}
                  disabled={busy}
                  className="btn btn-ghost btn-sm"
                  title={t("Send a test notification")}
                >
                  <Send size={13} />
                  {tested === null ? t("Test") : `${tested}`}
                </button>
                <button
                  type="button"
                  onClick={markAllRead}
                  className="grid h-8 w-8 place-items-center rounded-lg text-ink/40 hover:bg-white hover:text-ink"
                  aria-label={t("Mark all read")}
                >
                  <CheckCheck size={14} />
                </button>
                <button
                  type="button"
                  onClick={clearNotifications}
                  className="grid h-8 w-8 place-items-center rounded-lg text-ink/40 hover:bg-white hover:text-coral"
                  aria-label={t("Clear notifications")}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {pushState === "unsupported" ? (
              <p className="border-t border-ink/8 px-4 py-2 text-[10px] font-bold text-ink/40">
                {t("This browser does not support web notifications.")}
              </p>
            ) : null}
            {pushState === "denied" ? (
              <p className="border-t border-ink/8 px-4 py-2 text-[10px] font-bold text-ink/40">
                {t("Allow notifications in your browser settings to receive alerts.")}
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
