"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Minus, Plus, X } from "lucide-react";
import type { Product, SelectedModifier, Store } from "@/lib/types";
import { money } from "@/lib/utils";
import { tapFeedback } from "@/lib/haptics";
import { useI18n } from "./locale-provider";
import { useCart } from "./cart-provider";
import { productVisual } from "./product-icon";

function defaultSelections(product: Product) {
  const next: Record<string, string[]> = {};
  for (const group of product.modifiers ?? []) {
    next[group.id] = group.required ? group.options.slice(0, 1).map((option) => option.id) : [];
  }
  return next;
}

export function ProductSheet({
  product,
  store,
  onClose,
}: {
  product: Product;
  store: Store;
  onClose: () => void;
}) {
  const { addItem } = useCart();
  const { t } = useI18n();
  const [qty, setQty] = useState(1);
  const visual = productVisual(product.name, product.category);
  const ProductGlyph = visual.Icon;
  const [selections, setSelections] = useState<Record<string, string[]>>(() =>
    defaultSelections(product),
  );

  useEffect(() => {
    setQty(1);
    setSelections(defaultSelections(product));
  }, [product]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const chosen: SelectedModifier[] = useMemo(() => {
    const result: SelectedModifier[] = [];
    for (const group of product.modifiers ?? []) {
      for (const optionId of selections[group.id] ?? []) {
        const option = group.options.find((item) => item.id === optionId);
        if (!option) continue;
        result.push({
          groupId: group.id,
          groupName: group.name,
          optionId: option.id,
          optionName: option.name,
          priceDelta: option.priceDelta,
        });
      }
    }
    return result;
  }, [product.modifiers, selections]);

  const unitPrice = product.price + chosen.reduce((sum, option) => sum + option.priceDelta, 0);

  const incomplete = (product.modifiers ?? []).some((group) => {
    const count = (selections[group.id] ?? []).length;
    return count < group.min || count > group.max;
  });

  function toggle(groupId: string, optionId: string, max: number) {
    setSelections((current) => {
      const active = current[groupId] ?? [];
      const exists = active.includes(optionId);
      let next: string[];
      if (exists) {
        next = active.filter((id) => id !== optionId);
      } else if (max === 1) {
        next = [optionId];
      } else if (active.length >= max) {
        next = [...active.slice(1), optionId];
      } else {
        next = [...active, optionId];
      }
      return { ...current, [groupId]: next };
    });
  }

  function add() {
    tapFeedback();
    addItem(
      {
        productId: product.id,
        storeId: store.id,
        storeSlug: store.slug,
        storeName: store.name,
        citySlug: store.citySlug,
        storeLat: store.lat,
        storeLng: store.lng,
        deliveryFee: store.deliveryFee,
        minOrder: store.minOrder,
        name: product.name,
        emoji: product.emoji,
        basePrice: product.price,
        price: unitPrice,
        options: chosen,
      },
      qty,
    );
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={product.name}
        className="sheet-in flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[16px] bg-surface shadow-2xl sm:rounded-[12px]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative shrink-0">
          <div className={`relative grid h-32 place-items-center overflow-hidden ${visual.tile} sm:h-36`}>
            <div
              aria-hidden
              className="absolute inset-0 opacity-60"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 50% 120%, rgba(15,110,110,.16), transparent 62%)",
              }}
            />
            <ProductGlyph
              size={52}
              strokeWidth={1.45}
              className={`relative ${visual.ink}`}
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute end-3 top-3 grid h-9 w-9 place-items-center rounded-[4px] bg-surface/90 text-muted hover:text-ink"
            aria-label={t("Close")}
          >
            <X size={17} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="flex flex-wrap items-center gap-1.5">
            {product.tags?.map((tag) => (
              <span
                key={tag}
                className="rounded-[2px] bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-ink"
              >
                {tag}
              </span>
            ))}
            {product.calories ? (
              <span className="rounded-[2px] bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted">
                {product.calories} kcal
              </span>
            ) : null}
          </div>
          <h2 className="mt-2 text-2xl font-extrabold tracking-[-0.04em]">{product.name}</h2>
          <p className="mt-1 text-[13px] leading-6 text-muted">{product.description}</p>
          <div className="mt-2 text-base font-extrabold">{money(product.price)}</div>

          <div className="mt-5 space-y-5">
            {(product.modifiers ?? []).map((group) => {
              const selected = selections[group.id] ?? [];
              const atLimit = selected.length >= group.max;
              return (
                <fieldset key={group.id}>
                  <legend className="flex w-full items-baseline justify-between gap-2">
                    <span className="text-[13px] font-extrabold">{group.name}</span>
                    <span className="text-[9px] font-bold uppercase tracking-wide text-ink/35">
                      {group.required ? t("Required") : t("Optional")}
                      {group.max > 1 ? ` · ${t("up to {max}", { max: group.max })}` : ""}
                    </span>
                  </legend>
                  <div className="mt-2 space-y-1.5">
                    {group.options.map((option) => {
                      const checked = selected.includes(option.id);
                      const disabled = option.soldOut;
                      const dimmed = !checked && atLimit && group.max > 1;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => toggle(group.id, option.id, group.max)}
                          className={`flex w-full items-center gap-3 rounded-[6px] border px-3 py-2.5 text-start transition-colors ${
                            checked
                              ? "border-teal bg-teal/6"
                              : dimmed
                                ? "border-ink/8 bg-white opacity-45"
                                : "border-ink/10 bg-white hover:border-teal/40"
                          }`}
                        >
                          <span
                            className={`grid h-4 w-4 shrink-0 place-items-center border ${
                              group.max === 1 ? "rounded-full" : "rounded-[4px]"
                            } ${checked ? "border-teal bg-teal text-on-dark" : "border-ink/25"}`}
                          >
                            {checked ? <Check size={10} strokeWidth={3} /> : null}
                          </span>
                          <span className="flex-1 text-[12px] font-bold">
                            {option.name}
                            {option.soldOut ? (
                              <span className="ms-2 text-[10px] text-danger">{t("Sold out")}</span>
                            ) : null}
                          </span>
                          <span className="text-[11px] font-extrabold text-ink/45">
                            {option.priceDelta === 0 ? t("Free") : `+${money(option.priceDelta)}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              );
            })}
          </div>
        </div>

        <div className="shrink-0 border-t border-ink/8 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-[4px] border border-line p-1">
              <button
                type="button"
                onClick={() => setQty((value) => Math.max(1, value - 1))}
                className="grid h-9 w-9 place-items-center rounded-[4px] hover:bg-surface-2"
                aria-label={t("Decrease quantity")}
              >
                <Minus size={15} />
              </button>
              <span className="w-6 text-center text-sm font-extrabold">{qty}</span>
              <button
                type="button"
                onClick={() => setQty((value) => Math.min(20, value + 1))}
                className="grid h-9 w-9 place-items-center rounded-[4px] hover:bg-surface-2"
                aria-label={t("Increase quantity")}
              >
                <Plus size={15} />
              </button>
            </div>
            <button
              type="button"
              onClick={add}
              disabled={incomplete}
              className="btn btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {t("Add to cart · {price}", { price: money(unitPrice * qty) })}
            </button>
          </div>
          {incomplete ? (
            <p className="mt-2 text-center text-[10px] font-bold text-ink/35">
              Choose the required options to continue.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
