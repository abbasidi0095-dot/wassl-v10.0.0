"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { BusinessAccount, BusinessOrder } from "@/lib/types";
import { money, timeAgo } from "@/lib/utils";
import { useI18n } from "@/components/locale-provider";

export function BusinessAdmin({
  initialAccounts,
  initialOrders,
}: {
  initialAccounts: BusinessAccount[];
  initialOrders: BusinessOrder[];
}) {
  const { t } = useI18n();
  const [accounts, setAccounts] = useState(initialAccounts);
  const [orders, setOrders] = useState(initialOrders);
  const [busy, setBusy] = useState("");

  async function accountStatus(account: BusinessAccount, status: string) {
    setBusy(account.id);
    try {
      const response = await fetch(`/api/admin/business/accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = (await response.json()) as {
        account?: BusinessAccount;
        error?: string;
      };
      if (data.account) {
        setAccounts((current) =>
          current.map((entry) => (entry.id === data.account!.id ? data.account! : entry)),
        );
      }
    } finally {
      setBusy("");
    }
  }

  async function orderStatus(order: BusinessOrder, status: string) {
    setBusy(order.id);
    try {
      const response = await fetch(`/api/admin/business/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = (await response.json()) as {
        order?: BusinessOrder;
        error?: string;
      };
      if (data.order) {
        setOrders((current) =>
          current.map((entry) => (entry.id === data.order!.id ? data.order! : entry)),
        );
      }
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="mt-5 space-y-5">
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-semibold">{t("Business accounts")}</h2>
          <span className="pill">{accounts.length}</span>
        </div>
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {accounts.map((account) => (
            <article key={account.id} className="aero-tile rounded-[8px] border p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[13px] font-semibold">{account.companyName}</div>
                  <div className="text-[10px] text-muted">
                    {account.category} · {account.citySlug} · {account.contactName}
                  </div>
                  <div className="text-[10px] text-muted">
                    {account.phone} · {account.email}
                  </div>
                </div>
                <span className="pill">{t(account.status)}</span>
              </div>
              <div className="mt-3 flex gap-1">
                {account.status !== "approved" ? (
                  <button
                    type="button"
                    onClick={() => void accountStatus(account, "approved")}
                    disabled={busy === account.id}
                    className="btn btn-primary btn-sm"
                  >
                    {busy === account.id ? <Loader2 size={11} className="animate-spin" /> : null}
                    {t("Approve")}
                  </button>
                ) : null}
                {account.status !== "rejected" ? (
                  <button
                    type="button"
                    onClick={() => void accountStatus(account, "rejected")}
                    disabled={busy === account.id}
                    className="btn btn-ghost btn-sm text-danger"
                  >
                    {t("Reject")}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
          {!accounts.length ? (
            <p className="rounded-[8px] border border-dashed border-line px-4 py-8 text-center text-[11px] text-muted lg:col-span-2">
              {t("No business applications yet.")}
            </p>
          ) : null}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-semibold">{t("Wholesale orders")}</h2>
          <span className="pill">{orders.length}</span>
        </div>
        <div className="mt-3 space-y-2">
          {orders.map((order) => (
            <article key={order.id} className="aero-tile rounded-[8px] border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-[12px] font-semibold">{order.code}</div>
                  <div className="text-[10px] text-muted">
                    {order.items.length} {t("lines")} · {order.deliveryDate} · {timeAgo(order.createdAt)}
                  </div>
                </div>
                <div className="text-end">
                  <div className="text-[12px] font-semibold tnum">{money(order.subtotal)}</div>
                  <div className="text-[10px] text-muted capitalize">{t(order.status)}</div>
                </div>
              </div>
              <div className="mt-2 space-y-0.5 text-[10px] text-muted">
                {order.items.slice(0, 5).map((line) => (
                  <div key={line.productId}>
                    {line.name} × {line.qty} · {money(line.unitPrice)}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-1">
                {order.status === "requested" ? (
                  <button
                    type="button"
                    onClick={() => void orderStatus(order, "confirmed")}
                    disabled={busy === order.id}
                    className="btn btn-primary btn-sm"
                  >
                    {busy === order.id ? <Loader2 size={11} className="animate-spin" /> : null}
                    {t("Confirm")}
                  </button>
                ) : null}
                {order.status !== "cancelled" ? (
                  <button
                    type="button"
                    onClick={() => void orderStatus(order, "cancelled")}
                    disabled={busy === order.id}
                    className="btn btn-ghost btn-sm text-danger"
                  >
                    {t("Cancel")}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
          {!orders.length ? (
            <p className="rounded-[8px] border border-dashed border-line px-4 py-8 text-center text-[11px] text-muted">
              {t("No wholesale orders yet.")}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
