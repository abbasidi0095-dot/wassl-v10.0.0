"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "wassl.theme";

/** Keep the native status bar and PWA theme colour in sync with the page. */
function syncShell(dark: boolean) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#070c18" : "#2447e0");

  if (typeof window === "undefined") return;
  void import("@capacitor/core")
    .then(async ({ Capacitor }) => {
      if (!Capacitor.isNativePlatform()) return;
      const { StatusBar, Style } = await import("@capacitor/status-bar");
      await StatusBar.setStyle({ style: dark ? Style.Light : Style.Dark }).catch(() => {});
      await StatusBar.setBackgroundColor({ color: dark ? "#070c18" : "#f7f2e8" }).catch(
        () => {},
      );
    })
    .catch(() => {});
}

export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // Private mode: the toggle still works for this session.
    }
    setDark(next);
    syncShell(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={dark}
      title={dark ? "Light mode" : "Dark mode"}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-[6px] text-ink/70 transition-colors hover:bg-surface-2 hover:text-ink",
        className,
      )}
    >
      {dark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
