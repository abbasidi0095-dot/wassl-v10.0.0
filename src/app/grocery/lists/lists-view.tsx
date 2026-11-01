"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, CalendarClock, ListChecks, Repeat, Trash2 } from "lucide-react";
import { useI18n } from "@/components/locale-provider";
import { money } from "@/lib/utils";

type ListItem = {
  productId: string;
  name: string;
  price: number;
  unit?: string;
  checked: boolean;
  qty: number;
  storeName: string;
  storeSlug: string;
};

type List = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  recurring?: {
    enabled: boolean;
    frequency: "weekly" | "monthly";
    nextAt?: string;
    remind: boolean;
  };
  items: ListItem[];
};

export function ListsView({ initialLists }: { initialLists: List[] }) {
  const { t } = useI18n();
  const [lists, setLists] = useState(initialLists);

  async function updateRecurring(
    list: List,
    patch: {
      enabled?: boolean;
      frequency?: "weekly" | "monthly";
      remind?: boolean;
    },
  ) {
    const recurring = {
      enabled: patch.enabled ?? list.recurring?.enabled ?? false,
      frequency: patch.frequency ?? list.recurring?.frequency ?? "weekly",
      remind: patch.remind ?? list.recurring?.remind ?? true,
    };
    setLists((current) =>
      current.map((item) =>
        item.id === list.id ? { ...item, recurring: { ...item.recurring, ...recurring } } : item,
      ),
    );
    const response = await fetch("/api/grocery/lists", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listId: list.id, recurring }),
    }).catch(() => undefined);
    if (response?.ok) {
      const data = (await response.json()) as { list?: List };
      if (data.list) {
        setLists((current) =>
          current.map((item) => (item.id === list.id ? { ...item, recurring: data.list!.recurring } : item)),
        );
      }
    }
  }

  async function update(listId: string, productId: string, patch: { checked?: boolean; remove?: boolean; qty?: number }) {
    setLists((current) =>
      current.map((list) =>
        list.id === listId
          ? {
              ...list,
              items: patch.remove
                ? list.items.filter((item) => item.productId !== productId)
                : list.items.map((item) =>
                    item.productId === productId
                      ? {
                          ...item,
                          checked: patch.checked ?? item.checked,
                          qty: patch.qty ?? item.qty,
                        }
                      : item,
                  ),
            }
          : list,
      ),
    );
    await fetch("/api/grocery/lists", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listId, productId, ...patch }),
    }).catch(() => undefined);
  }

  if (!lists.length) {
    return (
      <div className="card mt-6 grid place-items-center px-6 py-16 text-center">
        <ListChecks size={26} className="text-brand" />
        <h2 className="mt-3 text-xl font-semibold">{t("No lists yet")}</h2>
        <p className="mt-1 text-sm text-muted">
          {t("Open a product and choose “Save to list” to start one.")}
        </p>
        <Link href="/grocery" className="btn btn-primary mt-5">
          {t("Browse groceries")} <ArrowRight size={14} className="rtl:-scale-x-100" />
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      {lists.map((list) => (
        <div key={list.id} className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <div className="text-sm font-semibold">{list.name}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] font-medium text-muted">
                <span>{list.items.length} {t("items")}</span>
                {list.recurring?.enabled ? (
                  <span className="inline-flex items-center gap-1 text-brand">
                    <Repeat size={10} />
                    {list.recurring.frequency === "weekly" ? t("Weekly") : t("Monthly")}
                  </span>
                ) : (
                  <span>{t("One-off basket")}</span>
                )}
              </div>
            </div>
            <ListChecks size={16} className="text-brand" />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface-2/50 px-4 py-2.5 text-[11px]">
            <label className="inline-flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={Boolean(list.recurring?.enabled)}
                onChange={(event) => void updateRecurring(list, { enabled: event.target.checked })}
                className="h-3.5 w-3.5 accent-teal"
              />
              {t("Recurring basket")}
            </label>
            <label className="inline-flex items-center gap-1.5 text-muted">
              <Repeat size={11} />
              <select
                value={list.recurring?.frequency ?? "weekly"}
                onChange={(event) =>
                  void updateRecurring(list, {
                    frequency: event.target.value as "weekly" | "monthly",
                  })
                }
                disabled={!list.recurring?.enabled}
                aria-label={t("Recurring frequency")}
                className="h-7 rounded-[4px] border border-line bg-surface px-1.5 text-[11px] text-ink disabled:opacity-40"
              >
                <option value="weekly">{t("Weekly")}</option>
                <option value="monthly">{t("Monthly")}</option>
              </select>
            </label>
            <label className="inline-flex items-center gap-1.5 text-muted">
              <input
                type="checkbox"
                checked={list.recurring?.remind ?? true}
                onChange={(event) => void updateRecurring(list, { remind: event.target.checked })}
                disabled={!list.recurring?.enabled}
                className="h-3.5 w-3.5 accent-teal disabled:opacity-40"
              />
              {t("Remind me")}
            </label>
            {list.recurring?.enabled && list.recurring.nextAt ? (
              <span className="inline-flex items-center gap-1 text-muted">
                <CalendarClock size={11} />
                {t("Next reminder {date}", {
                  date: new Intl.DateTimeFormat("en-GB", {
                    day: "numeric",
                    month: "short",
                  }).format(new Date(list.recurring.nextAt)),
                })}
              </span>
            ) : null}
          </div>
          <div className="divide-y divide-ink/5">
            {list.items.map((item) => (
              <div key={item.productId} className="flex items-center gap-3 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={(event) =>
                    update(list.id, item.productId, { checked: event.target.checked })
                  }
                  className="h-4 w-4 accent-teal"
                  aria-label={t("Mark {item}", { item: item.name })}
                />
                <div className="min-w-0 flex-1">
                  <div className={`truncate text-[13px] font-semibold ${item.checked ? "line-through opacity-50" : ""}`}>
                    {item.name}
                  </div>
                  <div className="text-[11px] font-bold text-muted">
                    {item.storeName} · {item.unit || "each"} · ×{item.qty}
                  </div>
                </div>
                <div className="text-xs font-semibold">{money(item.price * item.qty)}</div>
                <button
                  type="button"
                  onClick={() => update(list.id, item.productId, { remove: true })}
                  className="grid h-8 w-8 place-items-center rounded-[4px] text-muted hover:bg-danger-soft hover:text-coral"
                  aria-label={t("Remove item")}
                >
                  <Trash2 size={13} />
                </button>
                <Link href={`/store/${item.storeSlug}`} className="text-[11px] font-semibold text-brand">
                  {t("Shop")}
                </Link>
              </div>
            ))}
            {!list.items.length ? (
              <div className="px-4 py-6 text-center text-xs font-bold text-muted">
                {t("This list is empty.")}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
