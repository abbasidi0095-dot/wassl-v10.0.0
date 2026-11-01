"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  ChefHat,
  Loader2,
  Minus,
  Package,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { AssistantItem, AssistantPlan } from "@/lib/grocery-assistant";
import {
  addBasketLine,
  parseBasket,
  type BasketLine,
} from "@/lib/basket";
import { money } from "@/lib/utils";
import { useI18n } from "@/components/locale-provider";
import { ProductTile } from "@/components/product-icon";

const BASKET_KEY = "wassl_basket_v1";

const EXAMPLES = [
  "Prepare ingredients for couscous",
  "Find the cheapest bottled water",
  "Build a household cleaning basket",
  "Find baby essentials",
  "Find my usual weekly groceries",
  "Build a breakfast table",
];

type EditableItem = AssistantItem & { qty: number };

export function GroceryAssistant({ defaultCity }: { defaultCity: string }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [plan, setPlan] = useState<AssistantPlan | null>(null);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(false);
  const [basketCount, setBasketCount] = useState(0);

  async function ask(value: string) {
    const request = value.trim();
    if (request.length < 2) {
      setError(t("Describe what you need."));
      return;
    }
    setLoading(true);
    setError("");
    setAdded(false);
    try {
      const response = await fetch("/api/grocery/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: request, citySlug: defaultCity }),
      });
      const data = (await response.json()) as {
        plan?: AssistantPlan;
        error?: string;
      };
      if (!response.ok || !data.plan) {
        setError(data.error || t("Could not build a plan. Try another request."));
        return;
      }
      setPlan(data.plan);
      setItems(data.plan.items.map((item) => ({ ...item, qty: item.qty })));
    } catch {
      setError(t("Could not build a plan. Try another request."));
    } finally {
      setLoading(false);
    }
  }

  function setQty(productId: string, qty: number) {
    setItems((current) =>
      qty <= 0
        ? current.filter((item) => item.product.id !== productId)
        : current.map((item) =>
            item.product.id === productId
              ? { ...item, qty: Math.min(20, qty) }
              : item,
          ),
    );
  }

  function addAllToBasket() {
    let current: BasketLine[] = [];
    try {
      current = parseBasket(JSON.parse(window.localStorage.getItem(BASKET_KEY) || "[]"));
    } catch {
      current = [];
    }
    if (current.length && current[0].citySlug !== defaultCity) {
      setError(t("Finish or clear your basket before adding items from another city."));
      return;
    }
    let next = current;
    for (const item of items) {
      const stock = item.product.variants?.length
        ? item.product.variants.reduce((sum, variant) => sum + variant.stock, 0)
        : (item.product.stock ?? 0);
      if (!item.product.available || stock <= 0) continue;
      next = addBasketLine(
        next,
        {
          productId: item.product.id,
          storeId: item.store.id,
          storeSlug: item.store.slug,
          storeName: item.store.name,
          storeCategory: "grocery",
          citySlug: item.store.citySlug,
          storeLat: item.store.lat,
          storeLng: item.store.lng,
          name: item.product.name,
          image: item.product.image?.startsWith("data:") ? undefined : item.product.image,
          price: item.product.price,
          unit: item.product.unit,
          stock,
          deliveryFee: item.store.deliveryFee,
          minOrder: item.store.minOrder,
          substitution: "allow",
          barcode: item.product.barcode,
        },
        item.qty,
      );
    }
    try {
      window.localStorage.setItem(BASKET_KEY, JSON.stringify(next));
      setBasketCount(next.reduce((sum, line) => sum + line.qty, 0));
    } catch {
      setError(t("Could not save the basket in this browser."));
      return;
    }
    setAdded(true);
    setError("");
  }

  const total = items.reduce((sum, item) => sum + item.product.price * item.qty, 0);
  const storeCount = new Set(items.map((item) => item.store.id)).size;

  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="border-b border-line pb-6">
        <div className="eyebrow">
          <Sparkles size={14} /> {t("Smart shopping assistant")}
        </div>
        <h1 className="display mt-2 text-[clamp(2.2rem,1.6rem+3vw,3.8rem)]">
          {t("Tell us what you need.")}
        </h1>
        <p className="mt-3 max-w-[62ch] text-[14px] leading-6 text-muted">
          {t(
            "Describe a meal, a routine or a budget. We turn it into an editable grocery list using real stock and prices. Nothing is purchased automatically.",
          )}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/grocery/basket" className="btn btn-ghost btn-sm">
            {t("Open Wassl Basket")}
            {basketCount ? (
              <span className="ms-1 rounded-full bg-ink px-1.5 text-[10px] text-on-dark tnum">
                {basketCount}
              </span>
            ) : null}
          </Link>
          <Link href="/grocery/scan" className="btn btn-ghost btn-sm">
            {t("Scan barcode")}
          </Link>
        </div>
      </div>

      <form
        className="mt-6"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(query);
        }}
      >
        <div className="aero-tile rounded-[10px] border p-3">
          <textarea
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            rows={3}
            className="w-full resize-none bg-transparent px-2 py-1 text-[15px] outline-none placeholder:text-muted"
            placeholder={t("e.g. Prepare ingredients for couscous for four people")}
            aria-label={t("What do you need?")}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-1 pt-2">
            <span className="text-[11px] text-muted">
              {t("Real products, real stock, editable list.")}
            </span>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-sm disabled:opacity-40"
            >
              {loading ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <ChefHat size={13} />
              )}
              {loading ? t("Building…") : t("Build my list")}
            </button>
          </div>
        </div>
      </form>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => {
              setQuery(example);
              void ask(example);
            }}
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-[11px] font-medium text-muted hover:border-line-strong hover:text-ink"
          >
            {t(example)}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-4 rounded-[6px] bg-danger-soft px-3 py-2 text-[12px] font-medium text-danger">
          {error}
        </p>
      ) : null}

      {plan ? (
        <section className="mt-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="headline">
                {t(plan.titleKey, plan.titleVars)}
              </h2>
              <p className="mt-1 text-[13px] leading-6 text-muted">
                {t(plan.summaryKey)}
              </p>
            </div>
            <div className="text-end">
              <div className="text-[18px] font-semibold tnum">{money(total)}</div>
              <div className="text-[11px] text-muted">
                {items.length} {t("items")} · {storeCount}{" "}
                {storeCount === 1 ? t("store") : t("stores")}
              </div>
            </div>
          </div>

          {plan.missing.length ? (
            <p className="mt-3 rounded-[6px] bg-surface-2 px-3 py-2 text-[11px] text-muted">
              {t("Not found in local stock: {items}", {
                items: plan.missing.join(", "),
              })}
            </p>
          ) : null}

          <div className="mt-4 divide-y divide-line border-y border-line">
            {items.map((item) => (
              <div key={item.product.id} className="flex items-center gap-3 py-3">
                <ProductTile
                  name={item.product.name}
                  category={item.product.category}
                  image={item.product.image}
                  className="h-12 w-12 shrink-0 rounded-[6px]"
                  iconSize={19}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold">
                    {item.product.name}
                  </div>
                  <div className="truncate text-[11px] text-muted">
                    {item.store.name} · {item.label}
                  </div>
                  <div className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-brand">
                    {item.reason === "cheapest"
                      ? t("Lowest price")
                      : item.reason === "usual"
                        ? t("Your usual")
                        : item.reason === "recipe"
                          ? t("Recipe match")
                          : t("Match")}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setQty(item.product.id, item.qty - 1)}
                    className="grid h-7 w-7 place-items-center rounded-[4px] border border-line text-muted hover:text-ink"
                    aria-label={t("Decrease {name}", { name: item.product.name })}
                  >
                    <Minus size={11} />
                  </button>
                  <span className="w-6 text-center text-[12px] font-semibold tnum">
                    {item.qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQty(item.product.id, item.qty + 1)}
                    className="grid h-7 w-7 place-items-center rounded-[4px] border border-line text-muted hover:text-ink"
                    aria-label={t("Increase {name}", { name: item.product.name })}
                  >
                    <Plus size={11} />
                  </button>
                </div>
                <span className="w-16 shrink-0 text-end text-[12px] font-semibold tnum">
                  {money(item.product.price * item.qty)}
                </span>
                <button
                  type="button"
                  onClick={() => setQty(item.product.id, 0)}
                  className="grid h-7 w-7 place-items-center rounded-[4px] text-muted hover:bg-danger-soft hover:text-danger"
                  aria-label={t("Remove {name}", { name: item.product.name })}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={addAllToBasket}
              disabled={!items.length}
              className="btn btn-primary disabled:opacity-40"
            >
              <Package size={14} /> {t("Add all to basket")}
            </button>
            {added ? (
              <span className="inline-flex items-center gap-1.5 rounded-[6px] bg-success-soft px-3 py-2 text-[11px] font-medium text-success">
                <Check size={12} /> {t("Added to Wassl Basket")}
              </span>
            ) : null}
            {added ? (
              <Link href="/grocery/basket" className="btn btn-ghost btn-sm">
                {t("Review basket")}
                <ArrowRight size={12} />
              </Link>
            ) : null}
          </div>
          <p className="mt-3 text-[11px] text-muted">
            {t(
              "Edit quantities or remove anything. Checkout stays separate per store and nothing is purchased without your confirmation.",
            )}
          </p>
        </section>
      ) : !loading ? (
        <div className="mt-8 rounded-[8px] border border-dashed border-line px-5 py-12 text-center">
          <ChefHat size={22} className="mx-auto text-muted" />
          <p className="mt-3 text-[13px] font-medium">
            {t("Start with a meal, a routine or a budget.")}
          </p>
          <p className="mt-1 text-[12px] text-muted">
            {t("The list stays editable and nothing is ordered automatically.")}
          </p>
        </div>
      ) : null}
    </div>
  );
}
