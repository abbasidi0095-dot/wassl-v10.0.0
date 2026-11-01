"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bike,
  ChevronRight,
  Clock3,
  Grid2X2,
  Loader2,
  Package,
  Search,
  Sparkles,
  Store as StoreIcon,
  X,
} from "lucide-react";
import type { City } from "@/lib/types";
import type { SearchGroup, SearchHit, SearchKind, SearchResult } from "@/lib/search";
import { useI18n } from "@/components/locale-provider";
import { cn } from "@/lib/utils";

const RECENT_KEY = "wassl_recent_searches";

const GROUP_ICONS: Record<SearchKind, typeof Search> = {
  store: StoreIcon,
  product: Package,
  category: Grid2X2,
  service: Sparkles,
  delivery: Bike,
};

function readRecent(): string[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string").slice(0, 8)
      : [];
  } catch {
    return [];
  }
}

function writeRecent(values: string[]) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(values.slice(0, 8)));
  } catch {
    // Private mode: recent searches are a convenience, not a requirement.
  }
}

export function SearchExperience({
  cities,
  initialQuery,
  initialCity,
}: {
  cities: City[];
  initialQuery: string;
  initialCity: string;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState(initialQuery);
  const [citySlug, setCitySlug] = useState(initialCity);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRecent(readRecent());
  }, []);

  const remember = useCallback((value: string) => {
    const term = value.trim();
    if (!term) return;
    setRecent((current) => {
      const next = [term, ...current.filter((item) => item.toLowerCase() !== term.toLowerCase())].slice(0, 8);
      writeRecent(next);
      return next;
    });
  }, []);

  const runSearch = useCallback(
    async (term: string, city: string) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (term.trim()) params.set("q", term.trim());
        params.set("city", city);
        params.set("limit", "12");
        const response = await fetch(`/api/search?${params.toString()}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Search failed");
        setResult((await response.json()) as SearchResult);
      } catch {
        setError(t("Search is unavailable right now."));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void runSearch(query, citySlug);
    }, query.trim() ? 220 : 0);
    return () => window.clearTimeout(handle);
  }, [query, citySlug, runSearch]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (citySlug !== "dakhla") params.set("city", citySlug);
    const next = `/search${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState(null, "", next);
  }, [query, citySlug]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "/" && document.activeElement?.tagName !== "INPUT") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const suggestions = useMemo(() => {
    if (!result) return [];
    return result.suggestions.filter(
      (value) => value.toLowerCase() !== query.trim().toLowerCase(),
    );
  }, [result, query]);

  const groups = result?.groups ?? [];
  const hasQuery = Boolean(query.trim());
  const total = result?.total ?? 0;
  const showLanding = !hasQuery && !loading && !error;
  const showNoResults = hasQuery && !loading && !error && total === 0;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    remember(query);
    void runSearch(query, citySlug);
    inputRef.current?.blur();
  }

  function choose(value: string) {
    setQuery(value);
    remember(value);
    inputRef.current?.focus();
  }

  return (
    <div className="mx-auto max-w-[980px]">
      <div className="border-b border-line pb-6 pt-6 lg:pt-9">
        <p className="eyebrow">{t("Search Wassl")}</p>
        <h1 className="display mt-2 text-[clamp(2rem,1.5rem+2vw,3.2rem)]">
          {t("One search for the whole city.")}
        </h1>
        <p className="mt-3 max-w-[58ch] text-[14px] leading-6 text-muted">
          {t(
            "Restaurants, supermarkets, products, services and delivery options — from real Wassl data.",
          )}
        </p>

        <form onSubmit={submit} className="mt-6" role="search">
          <div
            className={cn(
              "flex items-center gap-2 rounded-[10px] border bg-surface p-1.5 transition-shadow",
              focused ? "border-brand shadow-[0_0_0_3px_rgba(11,74,69,0.12)]" : "border-line",
            )}
          >
            <Search size={19} className="ms-2 shrink-0 text-muted" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={t("Search restaurants, groceries, products…")}
              aria-label={t("Search Wassl")}
              autoComplete="off"
              className="h-11 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-[6px] text-muted hover:bg-surface-2 hover:text-ink"
                aria-label={t("Clear search")}
              >
                <X size={16} />
              </button>
            ) : null}
            <label className="hidden shrink-0 items-center gap-1.5 border-s border-line ps-2 sm:flex">
              <span className="sr-only">{t("City")}</span>
              <select
                value={citySlug}
                onChange={(event) => setCitySlug(event.target.value)}
                className="h-9 max-w-[130px] rounded-[6px] border border-line bg-surface px-2 text-[12px] font-medium outline-none focus:border-brand"
              >
                {cities.map((city) => (
                  <option key={city.slug} value={city.slug}>
                    {city.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn btn-primary btn-sm shrink-0">
              {t("Search")}
            </button>
          </div>
          <label className="mt-2 flex items-center gap-2 text-[12px] text-muted sm:hidden">
            <span>{t("City")}</span>
            <select
              value={citySlug}
              onChange={(event) => setCitySlug(event.target.value)}
              className="h-8 rounded-[6px] border border-line bg-surface px-2 text-[12px]"
            >
              {cities.map((city) => (
                <option key={city.slug} value={city.slug}>
                  {city.name}
                </option>
              ))}
            </select>
          </label>
        </form>
      </div>

      {showLanding && recent.length ? (
        <section className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[13px] font-semibold">{t("Recent searches")}</h2>
            <button
              type="button"
              onClick={() => {
                setRecent([]);
                writeRecent([]);
              }}
              className="text-[12px] font-medium text-muted hover:text-ink"
            >
              {t("Clear")}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {recent.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => choose(term)}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] font-medium hover:border-line-strong"
              >
                <Clock3 size={12} className="text-muted" />
                {term}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {showLanding && suggestions.length ? (
        <section className="mt-6">
          <h2 className="text-[13px] font-semibold">{t("Popular now")}</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => choose(suggestion)}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] font-medium hover:border-line-strong"
              >
                <Sparkles size={12} className="text-signal" />
                {t(suggestion)}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {loading ? (
        <div className="mt-8 space-y-3" aria-live="polite" aria-busy="true">
          <div className="flex items-center gap-2 text-[13px] text-muted">
            <Loader2 size={14} className="animate-spin" /> {t("Searching…")}
          </div>
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="h-[74px] animate-pulse rounded-[8px] border border-line bg-surface-2/60"
            />
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="mt-8 rounded-[8px] border border-danger/30 bg-danger-soft px-4 py-6 text-center">
          <p className="text-[13px] font-medium text-danger">{error}</p>
          <button
            type="button"
            onClick={() => void runSearch(query, citySlug)}
            className="btn btn-ghost btn-sm mt-3"
          >
            {t("Try again")}
          </button>
        </div>
      ) : null}

      {showNoResults ? (
        <div className="mt-8 rounded-[8px] border border-dashed border-line px-5 py-12 text-center">
          <Search size={22} className="mx-auto text-muted" />
          <h2 className="mt-4 font-display text-[24px] font-semibold tracking-[-0.03em]">
            {t("No results for “{query}”", { query })}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[13px] leading-6 text-muted">
            {t("Try a different spelling, a category, or a nearby city.")}
          </p>
        </div>
      ) : null}

      {!loading && !error && groups.length ? (
        <div className="mt-7 space-y-7">
          {groups.map((group) => (
            <SearchGroupBlock
              key={group.kind}
              group={group}
              query={query}
              onChoose={choose}
            />
          ))}
        </div>
      ) : null}

      {showLanding && !loading && !error && !recent.length && !suggestions.length ? (
        <div className="mt-8 rounded-[8px] border border-dashed border-line px-5 py-12 text-center">
          <Search size={22} className="mx-auto text-muted" />
          <h2 className="mt-4 font-display text-[24px] font-semibold tracking-[-0.03em]">
            {t("Search the whole city")}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[13px] leading-6 text-muted">
            {t("Try “grill”, “water”, “taxi” or a store name.")}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function SearchGroupBlock({
  group,
  query,
  onChoose,
}: {
  group: SearchGroup;
  query: string;
  onChoose: (value: string) => void;
}) {
  const { t } = useI18n();
  const Icon = GROUP_ICONS[group.kind];
  return (
    <section>
      <div className="flex items-center gap-2 border-b border-line pb-2">
        <Icon size={14} className="text-muted" />
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
          {t(group.label)}
        </h2>
        <span className="ms-auto text-[11px] text-muted tnum">{group.hits.length}</span>
      </div>
      <div className="divide-y divide-line">
        {group.hits.map((hit) => (
          <SearchHitRow
            key={`${hit.kind}-${hit.id}`}
            hit={hit}
            query={query}
            onChoose={onChoose}
          />
        ))}
      </div>
    </section>
  );
}

function SearchHitRow({
  hit,
  query,
  onChoose,
}: {
  hit: SearchHit;
  query: string;
  onChoose: (value: string) => void;
}) {
  const { t } = useI18n();
  const Icon = GROUP_ICONS[hit.kind];
  const title = hit.titleIsKey ? t(hit.title) : hit.title;
  const subtitle =
    hit.subtitle && hit.subtitleIsKey ? t(hit.subtitle) : hit.subtitle;

  return (
    <div className="flex items-center gap-3 py-3">
      <Link href={hit.href} className="group flex min-w-0 flex-1 items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[6px] border border-line bg-surface-2">
          {hit.image ? (
            // Uploaded/storefront images are already bounded; no optimizer needed.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={hit.image} alt="" className="h-full w-full object-cover" />
          ) : (
            <Icon size={18} className="text-muted" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[14px] font-semibold group-hover:text-brand">
              {title}
            </span>
            {hit.badge ? (
              <span className="rounded-[2px] bg-surface-2 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-muted">
                {t(hit.badge)}
              </span>
            ) : null}
            {hit.meta && hit.kind === "store" ? (
              <span
                className={cn(
                  "rounded-[2px] px-1.5 py-0.5 text-[9px] font-semibold uppercase",
                  hit.meta === "Open"
                    ? "bg-success-soft text-success"
                    : "bg-surface-2 text-muted",
                )}
              >
                {t(hit.meta)}
              </span>
            ) : null}
          </span>
          {subtitle ? (
            <span className="mt-0.5 block truncate text-[11px] text-muted">
              {subtitle}
            </span>
          ) : null}
        </span>
        {hit.meta && hit.kind !== "store" ? (
          <span className="shrink-0 text-[12px] font-semibold text-muted tnum">
            {hit.meta}
          </span>
        ) : null}
        <ChevronRight size={15} className="shrink-0 text-muted rtl:-scale-x-100" />
      </Link>
      {hit.kind === "product" && query.trim() ? (
        <button
          type="button"
          onClick={() => onChoose(hit.title)}
          className="hidden shrink-0 rounded-[4px] px-2 py-1 text-[11px] font-medium text-muted hover:bg-surface-2 hover:text-ink sm:block"
        >
          {t("More like this")}
        </button>
      ) : null}
    </div>
  );
}
