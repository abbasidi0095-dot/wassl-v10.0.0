"use client";

import { Languages } from "lucide-react";
import { LOCALES, LOCALE_META, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useI18n } from "./locale-provider";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <label
      className={cn(
        "relative inline-flex h-10 items-center rounded-xl border border-ink/10 bg-white/70 text-ink transition hover:bg-white",
        className,
      )}
      title={t("Language")}
    >
      <Languages
        size={15}
        className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-teal"
      />
      <select
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
        aria-label={t("Language")}
        className="h-full appearance-none bg-transparent ps-9 pe-7 text-xs font-extrabold text-ink outline-none"
      >
        {LOCALES.map((code) => (
          <option key={code} value={code} lang={code} title={LOCALE_META[code].native}>
            {code.toUpperCase()}
          </option>
        ))}
      </select>
    </label>
  );
}
