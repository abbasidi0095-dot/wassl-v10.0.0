"use client";

import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { useI18n } from "./locale-provider";

export function PwaUpdater() {
  const { t } = useI18n();
  const [updateReady, setUpdateReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;

    function check(registration: ServiceWorkerRegistration) {
      if (registration.waiting) setUpdateReady(true);
    }

    navigator.serviceWorker.ready
      .then((registration) => {
        if (cancelled) return;
        check(registration);
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateReady(true);
            }
          });
        });
      })
      .catch(() => undefined);

    function onMessage(event: MessageEvent) {
      if (event.data?.type === "WASSL_SW_UPDATED") setUpdateReady(true);
    }
    navigator.serviceWorker.addEventListener("message", onMessage);

    function onVisible() {
      if (document.visibilityState !== "visible") return;
      navigator.serviceWorker.ready
        .then((registration) => {
          void registration.update().catch(() => undefined);
          check(registration);
        })
        .catch(() => undefined);
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("message", onMessage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!updateReady || dismissed) return null;

  return (
    <div className="fixed inset-x-3 bottom-[calc(88px+env(safe-area-inset-bottom))] z-[120] mx-auto flex max-w-md items-center gap-3 rounded-[10px] border border-line bg-surface p-3 shadow-[var(--shadow-float)] md:bottom-5 md:end-5 md:start-auto md:mx-0">
      <RefreshCw size={16} className="shrink-0 text-brand" />
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-semibold">{t("Wassl has an update")}</div>
        <div className="text-[10px] text-muted">
          {t("Reload to get the latest version and splash.")}
        </div>
      </div>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="btn btn-primary btn-sm shrink-0"
      >
        {t("Reload")}
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-[4px] text-muted hover:bg-surface-2"
        aria-label={t("Dismiss")}
      >
        <X size={13} />
      </button>
    </div>
  );
}
