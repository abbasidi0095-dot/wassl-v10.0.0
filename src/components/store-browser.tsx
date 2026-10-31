"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, Store } from "lucide-react";
import { getOpenState } from "@/lib/hours";
import type { Store as StoreType } from "@/lib/types";
import { categoryLabel } from "@/lib/utils";
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

export function StoreBrowser({ stores }: { stores: StoreType[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [tag, setTag] = useState("all");
  const [sort, setSort] = useState<Sort>("recommended");
  const [openOnly, setOpenOnly] = useState(false);
  const [dietary, setDietary] = useState("all");

  const dietaryOptions = useMemo(
    () =>
      [...new Set(stores.flatMap((store) => store.dietaryTags ?? []))].sort(),
    [stores],
  );

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

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search
            size={16}
            className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-ink/35"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search stores, dishes or a neighbourhood…"
            className="input h-11 ps-10"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white/60 px-3 py-2 text-[10px] font-extrabold uppercase tracking-wide text-ink/50">
            <input
              type="checkbox"
              checked={openOnly}
              onChange={(event) => setOpenOnly(event.target.checked)}
              className="h-3 w-3 accent-teal"
            />
            Open only
          </label>
          <select
            value={dietary}
            onChange={(event) => setDietary(event.target.value)}
            className="rounded-full border border-ink/10 bg-white/60 px-3 py-2 text-[10px] font-extrabold uppercase tracking-wide text-ink/50 outline-none"
            aria-label="Dietary filter"
          >
            <option value="all">Any diet</option>
            {dietaryOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as Sort)}
            className="rounded-full border border-ink/10 bg-white/60 px-3 py-2 text-[10px] font-extrabold uppercase tracking-wide text-ink/50 outline-none"
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

      <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <span className="hidden items-center gap-1 whitespace-nowrap text-[10px] font-extrabold uppercase tracking-wider text-ink/35 sm:flex">
          <SlidersHorizontal size={12} /> Type
        </span>
        {CATEGORIES.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => {
              setCategory(item.value);
              setTag("all");
            }}
            className={`whitespace-nowrap rounded-full border px-3.5 py-2 text-[11px] font-extrabold transition ${
              category === item.value
                ? "border-teal bg-teal text-on-dark"
                : "border-ink/10 bg-white/60 text-ink/55 hover:border-teal/30 hover:text-ink"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setTag("all")}
          className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-extrabold transition ${
            tag === "all" ? "bg-ink text-on-dark" : "bg-white/60 text-ink/45 hover:text-ink"
          }`}
        >
          All cuisines
        </button>
        {TAGS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTag(tag === item ? "all" : item)}
            className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-extrabold transition ${
              tag === item ? "bg-ink text-on-dark" : "bg-white/60 text-ink/45 hover:text-ink"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <p className="text-xs font-bold text-ink/45">
          {filtered.length} {filtered.length === 1 ? "store" : "stores"}
          {storeCategoryLabel(category)}
          {tag !== "all" ? ` · ${tag}` : ""}
          {dietary !== "all" ? ` · ${dietary}` : ""}
        </p>
        <span className="hidden text-[10px] font-extrabold uppercase tracking-wider text-teal sm:block">
          {SORTS.find((option) => option.value === sort)?.label}
        </span>
      </div>

      {filtered.length ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((store) => (
            <StoreCard key={store.id} store={store} />
          ))}
        </div>
      ) : (
        <div className="mt-6 grid place-items-center rounded-3xl border border-dashed border-ink/15 bg-white/40 px-6 py-14 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-teal/10 text-teal">
            <Store size={24} />
          </span>
          <h3 className="mt-4 text-lg font-extrabold tracking-tight">No stores match</h3>
          <p className="mt-1 max-w-sm text-sm leading-6 text-ink/50">
            Try another category or search term. New stores are joining every week.
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
            className="btn btn-ghost mt-4"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}

function storeCategoryLabel(category: string) {
  return category === "all" ? "" : ` in ${categoryLabel(category)}`;
}
