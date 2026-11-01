"use client";

import { useState } from "react";
import { Check, Copy, Sparkles } from "lucide-react";
import { useI18n } from "./locale-provider";
import { PROMOS } from "@/lib/promos";
import { WASSL_NEWS } from "@/lib/news";

type TickerItem =
  | { kind: "promo"; id: string; code: string; label: string }
  | { kind: "news"; id: string; text: string };

function fallbackCopy(value: string) {
  try {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    document.body.removeChild(area);
    return true;
  } catch {
    return false;
  }
}

export function PromoTicker({
  citySlug,
  cityName,
  pharmacyLive,
  pharmacyCity,
}: {
  citySlug: string;
  cityName: string;
  pharmacyLive: boolean;
  pharmacyCity: string;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState<string | null>(null);

  const promos = PROMOS.filter(
    (promo) => !promo.cities?.length || promo.cities.includes(citySlug),
  ).map((promo) => ({
    kind: "promo" as const,
    id: `promo-${promo.code}`,
    code: promo.code,
    label: promo.label,
  }));

  const news: TickerItem[] = [
    {
      kind: "news",
      id: "city",
      text: t("Now delivering in {city}", { city: cityName }),
    },
    ...WASSL_NEWS.map((item) => ({
      kind: "news" as const,
      id: item.id,
      text: t(item.text),
    })),
    ...(pharmacyLive
      ? [
          {
            kind: "news" as const,
            id: "pharmacy-city",
            text: t("Pharmacy essentials delivered in {city}", { city: cityName }),
          },
        ]
      : [
          {
            kind: "news" as const,
            id: "pharmacy-laayoune",
            text: t("Pharmacy essentials now live in {city}", {
              city: pharmacyCity,
            }),
          },
        ]),
  ];

  const items: TickerItem[] = [...promos, ...news];

  async function copy(code: string) {
    let ok = false;
    try {
      await navigator.clipboard.writeText(code);
      ok = true;
    } catch {
      ok = fallbackCopy(code);
    }
    if (ok) {
      setCopied(code);
      window.setTimeout(() => setCopied((current) => (current === code ? null : current)), 2200);
    }
  }

  function entry(item: TickerItem, duplicate: boolean) {
    if (item.kind === "promo") {
      const done = copied === item.code;
      return (
        <button
          key={`${duplicate ? "b" : "a"}-${item.id}`}
          type="button"
          onClick={() => copy(item.code)}
          tabIndex={duplicate ? -1 : 0}
          className="promo-ticker__item group inline-flex shrink-0 items-center gap-2"
          aria-label={
            done
              ? t("Copied {code}", { code: item.code })
              : t("Copy promo code {code}", { code: item.code })
          }
        >
          <span className="promo-ticker__code rounded-[3px] bg-signal px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.06em] text-[#1c1305]">
            {item.code}
          </span>
          <span className="text-[11px] font-medium text-[#FFF7EA]/85">
            {t(item.label)}
          </span>
          {done ? (
            <Check size={11} className="text-signal" />
          ) : (
            <Copy
              size={10}
              className="text-[#FFF7EA]/45 transition-colors group-hover:text-[#FFF7EA]"
            />
          )}
        </button>
      );
    }
    return (
      <span
        key={`${duplicate ? "b" : "a"}-${item.id}`}
        className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-[#FFF7EA]/80"
      >
        <Sparkles size={11} className="text-signal" />
        {item.text}
      </span>
    );
  }

  return (
    <section
      className="promo-ticker relative border-b border-white/10 bg-[#0B1226] text-[#FFF7EA]"
      aria-label={t("Offers and news")}
    >
      <div className="promo-ticker__track py-2">
        {[false, true].map((duplicate) => (
          <div
            key={duplicate ? "duplicate" : "primary"}
            className="promo-ticker__group"
            aria-hidden={duplicate || undefined}
          >
            {items.map((item, index) => (
              <span key={`${duplicate ? "b" : "a"}-wrap-${item.id}`}>
                {entry(item, duplicate)}
                {index < items.length - 1 ? (
                  <span
                    className="mx-5 inline-block h-1 w-1 rounded-full bg-[#FFF7EA]/25 align-middle"
                    aria-hidden="true"
                  />
                ) : null}
              </span>
            ))}
          </div>
        ))}
      </div>
      <span className="sr-only" aria-live="polite">
        {copied ? t("Copied {code}", { code: copied }) : ""}
      </span>
    </section>
  );
}
