"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Search, ShoppingBasket } from "lucide-react";
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
      <div className="flex flex-col gap-3 border-y border-line py-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-[340px]">
          <Search
            size={15}
            className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="input h-10 ps-9 text-[13px]"
            placeholder={t("Search supermarkets…")}
            aria-label={t("Search supermarkets")}
          />
        </div>
        <div className="flex max-w-full items-center gap-1 overflow-x-auto scrollbar-none">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`min-h-9 whitespace-nowrap px-2.5 py-2 text-[12px] transition-colors ${
                filter === item.id
                  ? "bg-ink font-semibold text-paper"
                  : "text-muted hover:text-ink"
              }`}
            >
              {item.label}
            </button>
          ))}
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as "rating" | "name")}
            className="ms-1 h-9 shrink-0 rounded-[6px] border border-line bg-surface px-2.5 text-[12px] font-medium text-muted outline-none focus:border-brand md:w-40"
            aria-label={t("Sort stores")}
          >
            <option value="rating">{t("Top rated")}</option>
            <option value="name">{t("Name A–Z")}</option>
          </select>
        </div>
      </div>

      <p className="mt-4 text-[12px] text-muted tnum">
        {visible.length} {visible.length === 1 ? t("supermarket") : t("supermarkets")}
      </p>

      {visible.length ? (
        <div className="mt-2 border-t border-line">
          {visible.map(
            ({ store, photo, availability, settings }, index) => (
              <Link
                key={store.id}
                href={`/store/${store.slug}`}
                className="group grid gap-4 border-b border-line py-5 transition-colors hover:bg-surface md:grid-cols-[240px_1fr_auto] md:items-center md:gap-7"
              >
                <div className="relative aspect-[16/9] overflow-hidden rounded-[6px] bg-surface-2 md:aspect-[4/3]">
                  <Image
                    src={photo}
                    alt={store.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 240px"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
                    <span
                      className={`inline-flex items-center gap-1.5 ${
                        availability.open ? "text-success" : ""
                      }`}
                    >
                      <span
                        className={`status-dot ${
                          availability.open ? "live-dot" : ""
                        }`}
                      />
                      {availability.open ? t("Open now") : t("Closed")}
                      {availability.night ? ` · ${t("overnight")}` : ""}
                    </span>
                    <span className="text-line-strong">/</span>
                    <span className="tnum">
                      {store.prepTime}–{store.prepTime + 10} min
                    </span>
                    <span className="text-line-strong">/</span>
                    <span className="tnum">
                      {t("min {amount}", {
                        amount: money(
                          settings.deliveryZones[0]?.minOrder ?? store.minOrder,
                        ),
                      })}
                    </span>
                  </div>

                  <div className="mt-1.5 flex items-baseline gap-3">
                    <h3 className="font-display text-[24px] font-semibold tracking-[-0.03em]">
                      {store.name}
                    </h3>
                    <span className="arabic text-[13px] text-muted">
                      {store.nameAr}
                    </span>
                    <span className="text-[11px] text-muted tnum">
                      {store.rating || "New"}
                      {store.reviews ? ` · ${store.reviews}` : ""}
                    </span>
                  </div>

                  <p className="mt-1 max-w-[58ch] text-[12px] leading-5 text-muted" dir="auto">
                    {store.tagline}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
                    {availability.delivery ? <span>{t("Delivery")}</span> : null}
                    {availability.pickup ? <span>{t("Pickup")}</span> : null}
                    {availability.express ? (
                      <span>
                        {t("Express {minutes} min", {
                          minutes: settings.expressMinutes,
                        })}
                      </span>
                    ) : null}
                    {availability.night ? (
                      <span>
                        {t("Night fee {amount}", {
                          amount: money(settings.nightFee),
                        })}
                      </span>
                    ) : null}
                    <span>{store.landmark}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-6 md:flex-col md:items-end">
                  <div className="text-end">
                    <div className="text-[11px] text-muted">{t("Delivery from")}</div>
                    <div className="text-[15px] font-semibold tnum">
                      {money(
                        settings.deliveryZones[0]?.fee ?? store.deliveryFee,
                      )}
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[12px] font-medium text-brand">
                    {t("Shop")}
                    <ArrowRight
                      size={13}
                      className="transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100"
                    />
                  </span>
                </div>
              </Link>
            ),
          )}
        </div>
      ) : (
        <div className="border-y border-line py-16 text-center">
          <ShoppingBasket size={22} className="mx-auto text-muted" />
          <h2 className="mt-3 font-display text-xl font-semibold">
            {t("No supermarkets match")}
          </h2>
          <p className="mt-1 text-[13px] text-muted">
            {t("Try another filter or city — more partners are onboarding.")}
          </p>
        </div>
      )}
    </div>
  );
}
