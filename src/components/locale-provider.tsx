"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  dirFor,
  LOCALE_COOKIE,
  translate,
  type Locale,
} from "@/lib/i18n";

type LocaleContextValue = {
  locale: Locale;
  dir: "ltr" | "rtl";
  setLocale: (locale: Locale) => void;
  t: (text: string, vars?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState(initialLocale);
  const [, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    setLocaleState(initialLocale);
  }, [initialLocale]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      dir: dirFor(locale),
      t: (text, vars) => translate(locale, text, vars),
      setLocale: (next) => {
        setLocaleState(next);
        document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
        try {
          localStorage.setItem("wassl.locale", next);
        } catch {
          // Private mode: the cookie still drives server rendering.
        }
        document.documentElement.lang = next;
        document.documentElement.dir = dirFor(next);
        startTransition(() => router.refresh());
      },
    }),
    [locale, router],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useI18n must be used inside LocaleProvider");
  }
  return context;
}
