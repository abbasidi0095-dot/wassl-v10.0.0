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
        "relative inline-flex h-9 items-center rounded-[6px] text-ink transition-colors hover:bg-surface-2",
        className,
      )}
      title={t("Language")}
    >
      <Languages
        size={15}
        className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-muted"
      />
      <select
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
        aria-label={t("Language")}
        className="h-full appearance-none bg-transparent ps-8 pe-6 text-[13px] font-medium text-ink outline-none"
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
