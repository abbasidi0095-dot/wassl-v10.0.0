import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE, translate, type Locale } from "./i18n";

/** Locale is stored in a cookie so server components render the right language. */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : "en";
}

export async function getTranslator(): Promise<{
  locale: Locale;
  t: (text: string, vars?: Record<string, string | number>) => string;
}> {
  const locale = await getLocale();
  return {
    locale,
    t: (text, vars) => translate(locale, text, vars),
  };
}
