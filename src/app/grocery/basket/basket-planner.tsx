"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  Loader2,
  ScanBarcode,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingBasket,
  Sparkles,
  Store as StoreIcon,
  Trash2,
} from "lucide-react";
import type { City } from "@/lib/types";
import type { SearchHit } from "@/lib/search";
import {
  addBasketLine,
  basketTotals,
  groupBasket,
  hasMixedCities,
  parseBasket,
  setBasketQty,
  setGroupSubstitution,
  type BasketLine,
  type BasketSubstitution,
} from "@/lib/basket";
import { money } from "@/lib/utils";
import { useI18n } from "@/components/locale-provider";
import { ProductTile } from "@/components/product-icon";

const STORAGE_KEY = "wassl_basket_v1";

export function BasketPlanner({
  cities,
  defaultCity,
}: {
  cities: City[];
  defaultCity: string;
}) {
  const { t } = useI18n();
  const [lines, setLines] = useState<BasketLine[]>([]);
  const [ready, setReady] = useState(false);
  const [citySlug, setCitySlug] = useState(defaultCity);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const parsed = parseBasket(
        JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]"),
      );
      if (parsed.length) {
        setLines(parsed);
        setCitySlug(parsed[0].citySlug);
      }
    } catch {
      // Ignore a malformed local basket.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // Private mode: the basket stays in memory for this session.
    }
  }, [lines, ready]);

  useEffect(() => {
    let active = true;
    const handle = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          q: query.trim(),
          city: citySlug,
          limit: "30",
        });
        const response = await fetch(`/api/search?${params.toString()}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("search");
        const data = (await response.json()) as { groups?: Array<{ kind: string; hits: SearchHit[] }> };
        const products = (data.groups ?? [])
          .filter((group) => group.kind === "product")
          .flatMap((group) => group.hits)
          .filter((hit) => hit.storeCategory === "grocery");
        if (active) setResults(products.slice(0, 12));
      } catch {
        if (active) setError(t("Could not search products. Try again."));
      } finally {
        if (active) setLoading(false);
      }
    }, query.trim() ? 250 : 0);
    return () => {
      active = false;
      window.clearTimeout(handle);
    };
  }, [query, citySlug, t]);

  const groups = useMemo(() => groupBasket(lines), [lines]);
  const totals = useMemo(() => basketTotals(groups), [groups]);
  const mixed = hasMixedCities(lines);
  const city = cities.find((item) => item.slug === citySlug);

  function add(hit: SearchHit) {
    if (
      !hit.storeId ||
      !hit.storeSlug ||
      !hit.storeName ||
      !hit.citySlug ||
      hit.price === undefined
    ) {
      return;
    }
    if (lines.length && hit.citySlug !== lines[0].citySlug) {
      setError(t("Finish or clear this basket before adding items from another city."));
      return;
    }
    setError("");
    setLines((current) =>
      addBasketLine(current, {
        productId: hit.id,
        storeId: hit.storeId!,
        storeSlug: hit.storeSlug!,
        storeName: hit.storeName!,
        storeCategory: "grocery",
        citySlug: hit.citySlug!,
        storeLat: hit.storeLat ?? 0,
        storeLng: hit.storeLng ?? 0,
        name: hit.title,
        image: hit.image,
        price: hit.price!,
        unit: hit.unit,
        stock: hit.stock ?? 0,
        deliveryFee: hit.deliveryFee ?? 0,
        minOrder: hit.minOrder ?? 0,
        substitution: "allow",
        barcode: hit.barcode,
      }),
    );
  }

  function changeCity(next: string) {
    if (lines.length) {
      setError(t("Clear the basket before switching city."));
      return;
    }
    setCitySlug(next);
  }

  function clearBasket() {
    if (lines.length && !window.confirm(t("Clear every item from this basket?"))) {
      return;
    }
    setLines([]);
    setError("");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.45fr_0.85fr] lg:items-start">
      <div className="min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="eyebrow">
              <ShoppingBasket size={14} /> {t("Wassl Basket")}
            </div>
            <h1 className="display mt-2 text-[clamp(2.2rem,1.6rem+3vw,4rem)]">
              {t("One list. Several stores.")}
            </h1>
            <p className="mt-3 max-w-[58ch] text-[14px] leading-6 text-muted">
              {t(
                "Compare prices, pick substitutions and check out as separate orders from each store — with their own delivery fee, driver and handover code.",
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/grocery/assistant" className="btn btn-ghost btn-sm">
              <Sparkles size={12} /> {t("Shopping assistant")}
            </Link>
            <Link href="/grocery/scan" className="btn btn-ghost btn-sm">
              <ScanBarcode size={12} /> {t("Scan barcode")}
            </Link>
            <button type="button" onClick={clearBasket} className="btn btn-ghost btn-sm">
              <Trash2 size={12} /> {t("Clear basket")}
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-y border-line py-3">
          <label className="flex items-center gap-2 text-[12px] font-medium text-muted">
            <StoreIcon size={13} />
            {t("City")}
            <select
              value={citySlug}
              onChange={(event) => changeCity(event.target.value)}
              className="h-9 rounded-[6px] border border-line bg-surface px-2 text-[12px] text-ink outline-none focus:border-brand"
            >
              {cities.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <span className="text-[11px] text-muted">
            {t("Prices and stock are checked again by the server at checkout.")}
          </span>
        </div>

        <div className="relative mt-4">
          <Search
            size={16}
            className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="input h-11 ps-9 text-[14px]"
            placeholder={t("Search groceries across stores…")}
            aria-label={t("Search groceries across stores")}
          />
          {loading ? (
            <Loader2
              size={15}
              className="absolute end-3 top-1/2 -translate-y-1/2 animate-spin text-muted"
            />
          ) : null}
        </div>

        {error ? (
          <p className="mt-3 rounded-[6px] bg-danger-soft px-3 py-2 text-[12px] font-medium text-danger">
            {error}
          </p>
        ) : null}

        {results.length ? (
          <section className="mt-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
                {query.trim() ? t("Search results") : t("Popular groceries")}
              </h2>
              <span className="text-[11px] text-muted tnum">{results.length}</span>
            </div>
            <div className="mt-2 divide-y divide-line border-y border-line">
              {results.map((hit) => {
                const inBasket = lines.some(
                  (line) => line.productId === hit.id && line.storeId === hit.storeId,
                );
                return (
                  <div key={`${hit.storeId}-${hit.id}`} className="flex items-center gap-3 py-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[6px] bg-surface-2">
                      {hit.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={hit.image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Package size={17} className="text-muted" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold">{hit.title}</div>
                      <div className="truncate text-[11px] text-muted">
                        {hit.storeName} · {hit.unit || t("each")}
                        {hit.badge ? ` · ${t(hit.badge)}` : ""}
                      </div>
                    </div>
                    <span className="shrink-0 text-[12px] font-semibold tnum">
                      {money(hit.price ?? 0)}
                    </span>
                    <button
                      type="button"
                      onClick={() => add(hit)}
                      disabled={hit.badge === "Sold out"}
                      className="btn btn-ghost btn-sm shrink-0 disabled:opacity-40"
                    >
                      {inBasket ? <Check size={12} /> : <Plus size={12} />}
                      {inBasket ? t("Add more") : t("Add")}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
              {t("Your basket")}
            </h2>
            <span className="text-[11px] text-muted tnum">
              {totals.itemCount} {t("items")} · {totals.storeCount}{" "}
              {totals.storeCount === 1 ? t("store") : t("stores")}
            </span>
          </div>

          {!groups.length ? (
            <div className="mt-3 rounded-[8px] border border-dashed border-line px-5 py-12 text-center">
              <ShoppingBasket size={22} className="mx-auto text-muted" />
              <p className="mt-3 text-[13px] font-medium">{t("Your basket is empty.")}</p>
              <p className="mt-1 text-[12px] text-muted">
                {t("Search above, compare prices and add the first item.")}
              </p>
            </div>
          ) : (
            <div className="mt-3 space-y-4">
              {groups.map((group) => (
                <article key={group.storeId} className="aero-tile rounded-[10px] border">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
                    <div>
                      <Link
                        href={`/store/${group.storeSlug}`}
                        className="text-[14px] font-semibold hover:text-brand"
                      >
                        {group.storeName}
                      </Link>
                      <div className="mt-0.5 text-[11px] text-muted">
                        {t("{count} items · delivery {fee}", {
                          count: group.itemCount,
                          fee: money(group.deliveryFee),
                        })}
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-[11px] text-muted">
                      {t("Substitutions")}
                      <select
                        value={group.substitution}
                        onChange={(event) =>
                          setLines((current) =>
                            setGroupSubstitution(
                              current,
                              group.storeId,
                              event.target.value as BasketSubstitution,
                            ),
                          )
                        }
                        className="h-8 rounded-[5px] border border-line bg-surface px-2 text-[11px] text-ink"
                      >
                        <option value="allow">{t("Allow")}</option>
                        <option value="refund">{t("Refund")}</option>
                        <option value="contact">{t("Contact me")}</option>
                      </select>
                    </label>
                  </div>

                  <div className="divide-y divide-line px-4">
                    {group.lines.map((line) => (
                      <div key={line.productId} className="flex items-center gap-3 py-3">
                        <ProductTile
                          name={line.name}
                          category={line.barcode ? "grocery" : ""}
                          image={line.image}
                          className="h-11 w-11 shrink-0 rounded-[6px]"
                          iconSize={17}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-semibold">{line.name}</div>
                          <div className="truncate text-[11px] text-muted">
                            {line.unit || t("each")} · {money(line.price)}
                          </div>
                          <button
                            type="button"
                            onClick={() => setQuery(line.name)}
                            className="mt-1 text-[10px] font-medium text-brand underline decoration-brand/30 underline-offset-2"
                          >
                            {t("Compare prices")}
                          </button>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setLines((current) =>
                                setBasketQty(current, line.productId, line.qty - 1),
                              )
                            }
                            className="grid h-7 w-7 place-items-center rounded-[4px] border border-line text-muted hover:text-ink"
                            aria-label={t("Decrease {name}", { name: line.name })}
                          >
                            <Minus size={11} />
                          </button>
                          <span className="w-6 text-center text-[12px] font-semibold tnum">
                            {line.qty}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setLines((current) =>
                                setBasketQty(current, line.productId, line.qty + 1),
                              )
                            }
                            className="grid h-7 w-7 place-items-center rounded-[4px] border border-line text-muted hover:text-ink"
                            aria-label={t("Increase {name}", { name: line.name })}
                          >
                            <Plus size={11} />
                          </button>
                        </div>
                        <span className="w-16 shrink-0 text-end text-[12px] font-semibold tnum">
                          {money(line.price * line.qty)}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setLines((current) =>
                              setBasketQty(current, line.productId, 0),
                            )
                          }
                          className="grid h-7 w-7 place-items-center rounded-[4px] text-muted hover:bg-danger-soft hover:text-danger"
                          aria-label={t("Remove {name}", { name: line.name })}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-[11px]">
                    <span className={group.meetsMinimum ? "text-muted" : "font-medium text-danger"}>
                      {group.meetsMinimum
                        ? t("Minimum order met")
                        : t("Add {amount} more to reach the {minimum} minimum.", {
                            amount: money(group.minOrder - group.subtotal),
                            minimum: money(group.minOrder),
                          })}
                    </span>
                    <span className="font-semibold tnum">
                      {t("Store total")}: {money(group.total)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <aside className="aero-tile rounded-[10px] border p-5 lg:sticky lg:top-24">
        <h2 className="font-display text-[20px] font-semibold tracking-[-0.02em]">
          {t("Basket summary")}
        </h2>
        <div className="mt-4 space-y-2 text-[13px]">
          <div className="flex justify-between text-muted">
            <span>{t("Goods")}</span>
            <span className="font-medium text-ink tnum">{money(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>{t("Delivery")}</span>
            <span className="font-medium text-ink tnum">{money(totals.delivery)}</span>
          </div>
          <div className="flex justify-between border-t border-line pt-3 text-[16px] font-semibold">
            <span>{t("Total")}</span>
            <span className="tnum">{money(totals.total)}</span>
          </div>
        </div>

        <dl className="mt-4 space-y-2 border-t border-line pt-3 text-[11px] text-muted">
          <div className="flex justify-between">
            <dt>{t("Stores")}</dt>
            <dd className="tnum">{totals.storeCount}</dd>
          </div>
          <div className="flex justify-between">
            <dt>{t("Orders created")}</dt>
            <dd className="tnum">{totals.storeCount}</dd>
          </div>
          <div className="flex justify-between">
            <dt>{t("Payment")}</dt>
            <dd>{t("Cash on delivery")}</dd>
          </div>
        </dl>

        <p className="mt-4 rounded-[6px] bg-surface-2 px-3 py-2 text-[11px] leading-5 text-muted">
          {t(
            "Each store is fulfilled independently. You will pay each driver in cash and receive a separate handover code for every order.",
          )}
        </p>

        {mixed ? (
          <p className="mt-3 text-[11px] font-medium text-danger">
            {t("This basket contains more than one city. Remove the extra items to continue.")}
          </p>
        ) : null}

        <Link
          href="/grocery/basket/checkout"
          aria-disabled={!lines.length || totals.belowMinimum || mixed}
          className={`btn btn-primary mt-4 w-full ${
            !lines.length || totals.belowMinimum || mixed
              ? "pointer-events-none opacity-40"
              : ""
          }`}
        >
          {t("Continue to split checkout")}
          <ArrowRight size={14} className="rtl:-scale-x-100" />
        </Link>

        {totals.belowMinimum ? (
          <p className="mt-2 text-center text-[10px] text-danger">
            {t("Meet every store’s minimum before checkout.")}
          </p>
        ) : null}

        <p className="mt-3 text-center text-[10px] text-muted">
          {t("Prices and stock are validated again when the orders are created.")}
        </p>
      </aside>
    </div>
  );
}
