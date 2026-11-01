"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "./locale-provider";

const HOLD_MS = 1450;
const EXIT_MS = 380;

export function SplashIntro() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const timers = useRef<number[]>([]);
  const hiddenAt = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  }, []);

  const start = useCallback(() => {
    clearTimers();
    setLeaving(false);
    setVisible(true);
    document.documentElement.classList.add("wassl-splashing");
    timers.current.push(
      window.setTimeout(() => setLeaving(true), HOLD_MS),
      window.setTimeout(() => {
        setVisible(false);
        document.documentElement.classList.remove("wassl-splashing");
      }, HOLD_MS + EXIT_MS),
    );
  }, [clearTimers]);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setVisible(false);
      document.documentElement.classList.remove("wassl-splashing");
      return;
    }
    start();

    function onVisibility() {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
        return;
      }
      const awayFor = hiddenAt.current ? Date.now() - hiddenAt.current : 0;
      hiddenAt.current = null;
      // Reopening the home-screen app after a real pause behaves like a launch.
      if (awayFor > 3000) start();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clearTimers();
      document.documentElement.classList.remove("wassl-splashing");
    };
  }, [clearTimers, start]);

  function skip() {
    clearTimers();
    setLeaving(true);
    timers.current.push(
      window.setTimeout(() => {
        setVisible(false);
        document.documentElement.classList.remove("wassl-splashing");
      }, 180),
    );
  }

  if (!visible) return null;

  return (
    <div
      className={`wassl-splash fixed inset-0 z-[200] grid place-items-center bg-[#153F37] px-6 text-[#F4F0E6] ${
        leaving ? "wassl-splash-leaving" : ""
      }`}
      role="status"
      aria-label={t("Wassl is opening")}
    >
      <div className="flex w-full max-w-[280px] flex-col items-center text-center">
        <svg
          viewBox="0 0 64 64"
          className="h-[104px] w-[104px] overflow-visible"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M9 18.5 21.5 47 32 28.5 42.5 47 55 18.5"
            pathLength={1}
            stroke="#F4F0E6"
            strokeWidth="6.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="1"
            strokeDashoffset="1"
            className="wassl-splash-route"
          />
          <circle cx="9" cy="18.5" r="2.2" fill="#F4F0E6" className="wassl-splash-origin" />
          <circle
            cx="55"
            cy="18.5"
            r="4.6"
            stroke="#E6A23A"
            strokeWidth="2.6"
            className="wassl-splash-node"
          />
          <circle
            cx="55"
            cy="18.5"
            r="1.5"
            fill="#E6A23A"
            className="wassl-splash-node"
          />
        </svg>

        <div className="wassl-splash-word mt-7 flex items-baseline justify-center gap-2.5">
          <span className="font-display text-[42px] font-semibold leading-none tracking-[-0.045em]">
            Wassl
          </span>
          <span className="arabic text-[22px] font-medium leading-none text-[#F4F0E6]/70">
            وصّل
          </span>
        </div>
        <p className="wassl-splash-tag mt-4 text-[10px] font-medium uppercase tracking-[0.22em] text-[#F4F0E6]/45">
          {t("From the store to your door")}
        </p>

        <div className="wassl-splash-line mt-8 h-px w-full overflow-hidden bg-[#F4F0E6]/15">
          <span className="block h-full w-full origin-left bg-[#E6A23A]" />
        </div>
      </div>

      <button
        type="button"
        onClick={skip}
        className="absolute bottom-[calc(22px+env(safe-area-inset-bottom))] end-5 rounded-full border border-[#F4F0E6]/20 px-3 py-1.5 text-[10px] font-medium text-[#F4F0E6]/55 transition-colors hover:text-[#F4F0E6]"
      >
        {t("Skip")}
      </button>
    </div>
  );
}
