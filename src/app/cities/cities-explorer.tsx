"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, MapPin, Search } from "lucide-react";
import type { City } from "@/lib/types";
import { useI18n } from "@/components/locale-provider";

export function CitiesExplorer({ cities }: { cities: City[] }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"priority" | "all">("priority");
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return cities
      .filter((city) => (filter === "priority" ? city.priority : true))
      .filter((city) =>
        term
          ? `${city.name} ${city.nameAr} ${city.region}`.toLowerCase().includes(term)
          : true,
      );
  }, [cities, query, filter]);

  const priority = cities.filter((city) => city.priority);

  return (
    <div>
      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-ink/35"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="input h-11 ps-10"
            placeholder={t("Search 209 Moroccan cities…")}
          />
        </div>
        <div className="flex gap-2">
          {[
            { value: "priority" as const, label: t("Southern Morocco") },
            { value: "all" as const, label: t("All cities") },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={`rounded-xl border px-3.5 py-2 text-[11px] font-extrabold transition ${
                filter === item.value
                  ? "border-teal bg-teal text-on-dark"
                  : "border-ink/10 bg-white/60 text-ink/55"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {filter === "priority" && !query ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {priority.map((city) => (
            <Link
              key={city.id}
              href={`/city/${city.slug}`}
              className="card-flat group p-4 transition hover:-translate-y-1 hover:border-teal/30"
            >
              <div className="flex items-start justify-between">
                <span className="text-lg font-extrabold tracking-tight">{city.name}</span>
                <ArrowUpRight size={15} className="text-teal transition group-hover:translate-x-0.5 rtl:-scale-x-100" />
              </div>
              <div className="arabic mt-1 text-sm text-ink/40">{city.nameAr}</div>
              <div className="mt-5 flex items-center gap-1.5 text-[11px] font-medium text-teal">
                <span className="status-dot live-dot" /> {t("Live")}
              </div>
            </Link>
          ))}
        </div>
      ) : null}

      <div className="mt-6 flex items-center justify-between">
        <p className="text-xs font-bold text-ink/45">
          {t(filtered.length === 1 ? "{count} city" : "{count} cities", { count: filtered.length })}
        </p>
        <span className="text-[10px] font-bold text-ink/30">
          {filter === "priority" ? t("Priority operations") : t("Full national directory")}
        </span>
      </div>

      <div className="card mt-3 overflow-hidden">
        <div className="grid gap-px bg-ink/5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((city) => (
            <Link
              key={city.id}
              href={`/city/${city.slug}`}
              className="group flex items-center justify-between bg-paper px-4 py-3.5 transition hover:bg-cream"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal/8 text-teal">
                  <MapPin size={15} />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-extrabold">{city.name}</div>
                  <div className="arabic truncate text-[10px] text-ink/35">{city.nameAr}</div>
                </div>
              </div>
              <div className="ms-3 flex shrink-0 items-center gap-2">
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-medium ${
                    city.launchStatus === "live"
                      ? "bg-teal/10 text-teal"
                      : "bg-ink/5 text-ink/35"
                  }`}
                >
                  {city.launchStatus === "live" ? "Live" : "Soon"}
                </span>
                <ArrowUpRight size={13} className="text-ink/20 group-hover:text-teal" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
