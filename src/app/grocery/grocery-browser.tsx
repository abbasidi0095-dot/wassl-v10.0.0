"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Clock3,
  MapPin,
  Search,
  ShoppingBasket,
  Sparkles,
  Star,
  Truck,
} from "lucide-react";
import type { GrocerySettings, Store } from "@/lib/types";
import type { GroceryAvailability } from "@/lib/grocery";
import { useI18n } from "@/components/locale-provider";
import { money } from "@/lib/utils";

type Item = {
  store: Store;
  photo: string;
  settings: GrocerySettings;
  availability: GroceryAvailability;
};

type Filter = "all" | "open" | "delivery" | "pickup" | "express";

export function GroceryBrowser({ items }: { items: Item[] }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<"rating" | "name">("rating");

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return items
      .filter(({ store, availability }) => {
        if (filter === "open" && !availability.open) return false;
        if (filter === "delivery" && !availability.delivery) return false;
        if (filter === "pickup" && !availability.pickup) return false;
        if (filter === "express" && !availability.express) return false;
        if (!term) return true;
        return `${store.name} ${store.nameAr} ${store.tags?.join(" ") ?? ""}`
          .toLowerCase()
          .includes(term);
      })
      .sort((a, b) =>
        sort === "rating"
          ? b.store.rating - a.store.rating
          : a.store.name.localeCompare(b.store.name),
      );
  }, [items, query, filter, sort]);

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: t("All stores") },
    { id: "open", label: t("Open now") },
    { id: "delivery", label: t("Delivery") },
    { id: "pickup", label: t("Pickup") },
    { id: "express", label: t("Express") },
  ];

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
            placeholder={t("Search supermarkets…")}
            aria-label={t("Search supermarkets")}
          />
        </div>
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as "rating" | "name")}
          className="input h-11 md:w-44"
          aria-label={t("Sort stores")}
        >
          <option value="rating">{t("Top rated")}</option>
          <option value="name">{t("Name A–Z")}</option>
        </select>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`whitespace-nowrap rounded-full px-3.5 py-2 text-[11px] font-extrabold transition ${
              filter === item.id
                ? "bg-teal text-on-dark"
                : "border border-ink/10 bg-white/60 text-ink/55 hover:text-ink"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {visible.length ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map(({ store, photo, availability, settings }) => (
            <Link
              key={store.id}
              href={`/store/${store.slug}`}
              className="card group overflow-hidden transition hover:-translate-y-1 hover:border-teal/25"
            >
              <div className="relative h-40 overflow-hidden">
                <Image
                  src={photo}
                  alt={store.name}
                  fill
                  sizes="(max-width: 640px) 100vw, 33vw"
                  className="object-cover transition duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/10 to-transparent" />
                <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
                  <div>
                    <div className="text-lg font-extrabold leading-tight text-on-dark">
                      {store.name}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-bold text-on-dark/70">
                      <MapPin size={10} /> {store.citySlug}
                      <span>·</span>
                      <Star size={10} className="fill-saffron text-saffron" />
                      {store.rating || "New"}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-extrabold uppercase tracking-wide ${
                      availability.open
                        ? "bg-teal text-on-dark"
                        : "bg-ink/70 text-on-dark"
                    }`}
                  >
                    {availability.open ? t("Open") : t("Closed")}
                  </span>
                </div>
              </div>
              <div className="p-4">
                <div className="flex flex-wrap gap-1.5">
                  {availability.night ? (
                    <span className="pill pill-warm">{t("Night delivery")}</span>
                  ) : null}
                  {availability.delivery ? (
                    <span className="pill">
                      <Truck size={10} /> {t("Delivery")}
                    </span>
                  ) : null}
                  {availability.pickup ? (
                    <span className="pill">
                      <ShoppingBasket size={10} /> {t("Pickup")}
                    </span>
                  ) : null}
                  {availability.express ? (
                    <span className="pill">
                      <Sparkles size={10} /> {t("Express")}
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 flex items-center justify-between text-[10px] font-bold text-ink/40">
                  <span>
                    {t("Min. {amount}", { amount: money(settings.deliveryZones[0]?.minOrder ?? store.minOrder) })}
                    <span className="mx-1">·</span>
                    {t("{amount} delivery", { amount: money(settings.deliveryZones[0]?.fee ?? store.deliveryFee) })}
                  </span>
                  <span className="inline-flex items-center gap-1 text-teal">
                    <Clock3 size={11} />
                    {store.prepTime}–{store.prepTime + 10} min
                  </span>
                </div>
                <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-extrabold text-teal">
                  {t("Shop now")} <ArrowRight size={11} className="rtl:-scale-x-100" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card mt-5 grid place-items-center px-6 py-16 text-center">
          <ShoppingBasket size={28} className="text-teal" />
          <h2 className="mt-3 text-xl font-extrabold">{t("No supermarkets match")}</h2>
          <p className="mt-1 text-sm text-ink/45">
            {t("Try another filter or city — more partners are onboarding.")}
          </p>
        </div>
      )}
    </div>
  );
}
