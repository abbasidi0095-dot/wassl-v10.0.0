"use client";

import { useMemo, useState } from "react";
import { ArrowDown, Search } from "lucide-react";
import { getOpenState } from "@/lib/hours";
import type { Store as StoreType } from "@/lib/types";
import { categoryLabel } from "@/lib/utils";
import { useI18n } from "@/components/locale-provider";
import { StoreCard } from "./store-card";

const CATEGORIES = [
  { value: "all", label: "All stores" },
  { value: "restaurant", label: "Restaurants" },
  { value: "grocery", label: "Groceries" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "cafe", label: "Cafés" },
];

const TAGS = ["Seafood", "Moroccan", "Grill", "Fast food", "Café", "Groceries", "Pharmacy"];

type Sort = "recommended" | "rating" | "fastest" | "minimum";

const SORTS: { value: Sort; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "rating", label: "Top rated" },
  { value: "fastest", label: "Fastest" },
  { value: "minimum", label: "Lowest minimum" },
];

export function StoreBrowser({
  stores,
  initialLimit,
}: {
  stores: StoreType[];
  initialLimit?: number;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [tag, setTag] = useState("all");
  const [sort, setSort] = useState<Sort>("recommended");
  const [openOnly, setOpenOnly] = useState(false);
  const [dietary, setDietary] = useState("all");
  const [expanded, setExpanded] = useState(false);

  const dietaryOptions = useMemo(
    () => [...new Set(stores.flatMap((store) => store.dietaryTags ?? []))].sort(),
    [stores],
  );

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>([["all", stores.length]]);
    for (const store of stores) {
      counts.set(store.category, (counts.get(store.category) ?? 0) + 1);
    }
    return counts;
  }, [stores]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const result = stores
      .filter((store) => (category === "all" ? true : store.category === category))
      .filter((store) => (tag === "all" ? true : (store.tags ?? []).includes(tag)))
      .filter((store) =>
        dietary === "all" ? true : (store.dietaryTags ?? []).includes(dietary),
      )
      .filter((store) => (openOnly ? getOpenState(store).open : true))
      .filter((store) =>
        term
          ? [
              store.name,
              store.nameAr,
              store.tagline,
              store.landmark,
              store.address,
              categoryLabel(store.category),
              ...(store.tags ?? []),
            ]
              .join(" ")
              .toLowerCase()
              .includes(term)
          : true,
      );

    return result.sort((a, b) => {
      if (sort === "rating") return b.rating - a.rating || b.reviews - a.reviews;
      if (sort === "fastest") return a.prepTime - b.prepTime;
      if (sort === "minimum") return a.minOrder - b.minOrder;
      return (
        Number(b.isOpen) - Number(a.isOpen) ||
        b.rating - a.rating ||
        b.reviews - a.reviews
      );
    });
  }, [stores, query, category, tag, sort, openOnly, dietary]);

  const filtering =
    Boolean(query.trim()) ||
    category !== "all" ||
    tag !== "all" ||
    dietary !== "all" ||
    openOnly;
  const limited =
    initialLimit !== undefined && !filtering && !expanded
      ? Math.min(initialLimit, filtered.length)
      : filtered.length;
  const visible = filtered.slice(0, limited);
  const hidden = filtered.length - visible.length;

  return (
    <div>
      <div className="flex flex-col gap-3 border-y border-line py-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-[320px]">
          <Search
            size={15}
            className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("Search stores, dishes or a neighbourhood…")}
            className="input h-10 ps-9 text-[13px]"
            aria-label={t("Search stores")}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex h-10 items-center gap-2 rounded-[6px] border border-line px-3 text-[13px] font-medium text-muted">
            <input
              type="checkbox"
              checked={openOnly}
              onChange={(event) => setOpenOnly(event.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--brand)]"
            />
            {t("Open only")}
          </label>
          <select
            value={dietary}
            onChange={(event) => setDietary(event.target.value)}
            className="h-10 rounded-[6px] border border-line bg-surface px-2.5 text-[13px] font-medium text-muted outline-none focus:border-brand"
            aria-label="Dietary filter"
          >
            <option value="all">{t("Any diet")}</option>
            {dietaryOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as Sort)}
            className="h-10 rounded-[6px] border border-line bg-surface px-2.5 text-[13px] font-medium text-muted outline-none focus:border-brand"
            aria-label="Sort stores"
          >
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-1 flex items-center gap-1 overflow-x-auto border-b border-line scrollbar-none">
        {CATEGORIES.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => {
              setCategory(item.value);
              setTag("all");
            }}
            className={`relative whitespace-nowrap px-3 py-2.5 text-[13px] font-medium transition-colors ${
              category === item.value
                ? "text-ink after:absolute after:inset-x-3 after:bottom-0 after:h-[2px] after:bg-brand"
                : "text-muted hover:text-ink"
            }`}
          >
            {t(item.label)}
            <span className="ms-1.5 text-[11px] text-muted tnum">
              {categoryCounts.get(item.value) ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-1 flex items-center gap-4 overflow-x-auto border-b border-line pb-2.5 pt-1.5 scrollbar-none">
        <button
          type="button"
          onClick={() => setTag("all")}
          className={`whitespace-nowrap text-[13px] transition-colors ${
            tag === "all" ? "font-semibold text-ink" : "text-muted hover:text-ink"
          }`}
        >
          {t("All cuisines")}
        </button>
        {TAGS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTag(tag === item ? "all" : item)}
            className={`whitespace-nowrap text-[13px] transition-colors ${
              tag === item ? "font-semibold text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <p className="mt-5 flex flex-wrap items-baseline justify-between gap-2 text-[13px] text-muted tnum">
        <span>
          {filtered.length} {filtered.length === 1 ? t("store") : t("stores")}
          {storeCategoryLabel(category, t)}
          {tag !== "all" ? ` · ${tag}` : ""}
          {dietary !== "all" ? ` · ${dietary}` : ""}
        </span>
        {hidden > 0 ? (
          <span className="text-[11px]">
            {t("Showing {shown}", { shown: visible.length })}
          </span>
        ) : null}
      </p>

      {filtered.length ? (
        <>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((store) => (
              <StoreCard key={store.id} store={store} />
            ))}
          </div>
          {hidden > 0 || (expanded && initialLimit !== undefined) ? (
            <div className="mt-6 flex justify-center border-t border-line pt-6">
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="btn btn-ghost"
              >
                {hidden > 0
                  ? t("Show all {count} stores", { count: filtered.length })
                  : t("Show fewer stores")}
                <ArrowDown
                  size={14}
                  className={`transition-transform ${expanded ? "rotate-180" : ""}`}
                />
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="mt-4 border-y border-line py-16 text-center">
          <h3 className="font-display text-xl font-semibold">{t("No stores match")}</h3>
          <p className="mx-auto mt-2 max-w-sm text-[13px] leading-6 text-muted">
            {t("Try another category or search term. New stores are joining every week.")}
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCategory("all");
              setTag("all");
              setDietary("all");
              setOpenOnly(false);
            }}
            className="btn btn-ghost mt-5"
          >
            {t("Clear filters")}
          </button>
        </div>
      )}
    </div>
  );
}

function storeCategoryLabel(category: string, t: (value: string) => string) {
  return category === "all" ? "" : ` · ${t(categoryLabel(category))}`;
}
