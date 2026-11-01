"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  ShieldCheck,
  ShieldX,
  UserRound,
} from "lucide-react";
import type { AdminUserView } from "@/lib/db";
import type { Driver, Role, Store } from "@/lib/types";

type Draft = {
  role: Role;
  storeId: string;
  driverId: string;
};

type AccountStatus = "active" | "pending" | "rejected";

function statusOf(user: AdminUserView): AccountStatus {
  return user.accountStatus ?? "active";
}

function isDirty(user: AdminUserView, draft: Draft) {
  return (
    draft.role !== user.role ||
    draft.storeId !== (user.storeId ?? "") ||
    draft.driverId !== (user.driverId ?? "")
  );
}

function canSubmitDraft(draft: Draft) {
  if (draft.role === "merchant") return Boolean(draft.storeId);
  if (draft.role === "driver") return Boolean(draft.driverId);
  return true;
}

export function AccountsManager({
  initialUsers,
  stores,
  drivers,
}: {
  initialUsers: AdminUserView[];
  stores: Store[];
  drivers: Driver[];
}) {
  const [users, setUsers] = useState(initialUsers);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      initialUsers.map((user) => [
        user.id,
        {
          role: user.role,
          storeId: user.storeId ?? "",
          driverId: user.driverId ?? "",
        },
      ]),
    ),
  );
  const [query, setQuery] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  const ordered = useMemo(() => {
    return [...users]
      .filter((user) => {
        if (pendingOnly && statusOf(user) !== "pending") return false;
        const needle = query.trim().toLowerCase();
        if (!needle) return true;
        return (
          user.name.toLowerCase().includes(needle) ||
          user.email.toLowerCase().includes(needle) ||
          (user.requestedStoreName || "").toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => {
        const rank = (user: AdminUserView) =>
          statusOf(user) === "pending" ? 0 : statusOf(user) === "rejected" ? 1 : 2;
        const diff = rank(a) - rank(b);
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name);
      });
  }, [users, query, pendingOnly]);

  const pendingCount = users.filter((user) => statusOf(user) === "pending").length;
  const adminCount = users.filter(
    (user) => user.role === "admin" && statusOf(user) === "active",
  ).length;

  function updateDraft(userId: string, patch: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [userId]: { ...current[userId], ...patch },
    }));
  }

  function applyUser(user: AdminUserView) {
    setUsers((current) =>
      current.map((item) => (item.id === user.id ? user : item)),
    );
    setDrafts((current) => ({
      ...current,
      [user.id]: {
        role: user.role,
        storeId: user.storeId ?? "",
        driverId: user.driverId ?? "",
      },
    }));
  }

  async function callApi(
    user: AdminUserView,
    payload: Record<string, unknown>,
  ): Promise<AdminUserView | null> {
    setBusy(user.id);
    setToast("");
    setError("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, ...payload }),
      });
      const data = (await response.json()) as {
        error?: string;
        user?: AdminUserView;
      };
      if (!response.ok || !data.user) {
        setError(data.error || "Could not update the account");
        return null;
      }
      applyUser(data.user);
      return data.user;
    } catch {
      setError("Could not reach the server. Try again.");
      return null;
    } finally {
      setBusy("");
    }
  }

  async function adjustPoints(user: AdminUserView) {
    const raw = window.prompt(
      `Points adjustment for ${user.email}. Use a negative number to deduct.`,
      "0",
    );
    if (raw === null) return;
    const points = Number(raw);
    if (!Number.isInteger(points) || points === 0) {
      setError("Enter a non-zero whole number of points");
      return;
    }
    const note = window.prompt("Reason for the adjustment (recorded in the audit trail)", "") ?? "";
    setBusy(user.id);
    setToast("");
    setError("");
    try {
      const response = await fetch("/api/admin/loyalty", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, points, note }),
      });
      const data = (await response.json()) as {
        account?: { points: number };
        error?: string;
      };
      if (!response.ok || !data.account) {
        setError(data.error || "Could not adjust points");
        return;
      }
      setUsers((current) =>
        current.map((item) =>
          item.id === user.id
            ? { ...item, loyaltyPoints: data.account!.points }
            : item,
        ),
      );
      setToast(
        `${points > 0 ? "+" : ""}${points} points for ${user.name}. Balance ${data.account.points}.`,
      );
    } finally {
      setBusy("");
    }
  }

  async function approve(user: AdminUserView) {
    const draft = drafts[user.id];
    const result = await callApi(user, {
      action: "approve",
      storeId: draft.role === "merchant" ? draft.storeId || undefined : undefined,
      driverId: draft.role === "driver" ? draft.driverId || undefined : undefined,
    });
    if (!result) return;
    if (result.role === "merchant") {
      setToast(`${result.name} approved. Storefront provisioned.`);
    } else if (result.role === "driver") {
      setToast(`${result.name} approved. Driver profile created.`);
    } else {
      setToast(`${result.name} approved.`);
    }
  }

  async function grantAdmin(user: AdminUserView) {
    if (
      !window.confirm(
        `Grant full operations access to ${user.name}? They will see every store, driver, order and account.`,
      )
    ) {
      return;
    }
    const result = await callApi(user, {
      role: "admin",
      storeId: null,
      driverId: null,
    });
    if (result) setToast(`${result.name} now has admin access.`);
  }

  async function reject(user: AdminUserView) {
    if (!window.confirm(`Reject ${user.name}? They will not be able to sign in.`)) {
      return;
    }
    const result = await callApi(user, { action: "reject" });
    if (result) setToast(`${result.name} rejected.`);
  }

  async function save(user: AdminUserView) {
    const draft = drafts[user.id];
    const result = await callApi(user, {
      role: draft.role,
      storeId: draft.role === "merchant" ? draft.storeId || null : null,
      driverId: draft.role === "driver" ? draft.driverId || null : null,
    });
    if (result) setToast(`${result.name}'s access was updated.`);
  }

  return (
    <section className="mt-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.04em]">Accounts & access</h2>
          <p className="mt-1 text-[11px] text-muted">
            Customers are active immediately. Store owners and drivers stay
            pending until you approve them.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPendingOnly((value) => !value)}
            className={`rounded-[6px] border px-3 py-1.5 text-[11px] font-semibold transition ${
              pendingOnly
                ? "border-ink bg-ink text-on-dark"
                : "border-line bg-surface text-muted"
            }`}
          >
            Pending {pendingCount ? `· ${pendingCount}` : ""}
          </button>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, email or store…"
            className="input h-9 w-56 text-xs"
          />
        </div>
      </div>

      {toast ? (
        <p className="mt-3 flex items-center gap-1.5 rounded-[6px] bg-brand-soft px-3 py-2 text-xs font-bold text-brand">
          <CheckCircle2 size={14} /> {toast}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-[6px] bg-danger-soft px-3 py-2 text-xs font-bold text-danger">
          {error}
        </p>
      ) : null}

      <div className="card mt-3 overflow-hidden">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Account</th>
                <th>Role</th>
                <th>Store / driver</th>
                <th>Status</th>
                <th>Points</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {ordered.map((user) => {
                const draft = drafts[user.id];
                const status = statusOf(user);
                const dirty = isDirty(user, draft);
                const complete = canSubmitDraft(draft);
                const working = busy === user.id;
                return (
                  <tr key={user.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="grid h-8 w-8 place-items-center rounded-full bg-surface-2 text-muted">
                          <UserRound size={15} />
                        </div>
                        <div>
                          <div className="font-semibold">{user.name}</div>
                          <div className="text-[11px] text-muted">{user.email}</div>
                          {user.requestedStoreName ? (
                            <div className="text-[11px] font-semibold text-brand">
                              {user.requestedStoreName}
                            </div>
                          ) : null}
                          {user.phone || user.citySlug ? (
                            <div className="text-[11px] text-muted">
                              {[user.phone, user.citySlug].filter(Boolean).join(" · ")}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td>
                      <select
                        aria-label={`Role for ${user.email}`}
                        value={draft.role}
                        onChange={(event) =>
                          updateDraft(user.id, {
                            role: event.target.value as Role,
                            storeId: "",
                            driverId: "",
                          })
                        }
                        className="input h-8 w-32 text-xs"
                      >
                        <option value="customer">Customer</option>
                        <option value="merchant">Store owner</option>
                        <option value="driver">Driver</option>
                        <option value="admin">Operations</option>
                      </select>
                    </td>
                    <td>
                      {draft.role === "merchant" ? (
                        <select
                          aria-label={`Store for ${user.email}`}
                          value={draft.storeId}
                          onChange={(event) =>
                            updateDraft(user.id, { storeId: event.target.value })
                          }
                          className="input h-8 w-52 text-xs"
                        >
                          <option value="">Provision a new store on approval…</option>
                          {stores.map((store) => (
                            <option key={store.id} value={store.id}>
                              {store.name} · {store.citySlug}
                            </option>
                          ))}
                        </select>
                      ) : draft.role === "driver" ? (
                        <select
                          aria-label={`Driver for ${user.email}`}
                          value={draft.driverId}
                          onChange={(event) =>
                            updateDraft(user.id, { driverId: event.target.value })
                          }
                          className="input h-8 w-52 text-xs"
                        >
                          <option value="">Provision a new driver on approval…</option>
                          {drivers.map((driver) => (
                            <option key={driver.id} value={driver.id}>
                              {driver.name} · {driver.citySlug}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-[11px] text-muted">
                          {draft.role === "admin"
                            ? "Full platform access"
                            : "Customer storefront account"}
                        </span>
                      )}
                    </td>
                    <td>
                      {status === "pending" ? (
                        <span className="rounded-full bg-saffron/20 px-2 py-1 text-[11px] font-semibold uppercase text-saffron-deep">
                          Pending
                        </span>
                      ) : status === "rejected" ? (
                        <span className="rounded-full bg-danger-soft px-2 py-1 text-[11px] font-semibold uppercase text-danger">
                          Rejected
                        </span>
                      ) : (
                        <span className="rounded-full bg-brand-soft px-2 py-1 text-[11px] font-semibold uppercase text-brand">
                          Active
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-semibold tnum">
                          {user.loyaltyPoints ?? 0}
                        </span>
                        {user.role === "customer" ? (
                          <button
                            type="button"
                            onClick={() => void adjustPoints(user)}
                            disabled={working}
                            className="text-[11px] font-medium text-brand disabled:opacity-40"
                          >
                            Adjust
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1.5">
                        {status !== "active" &&
                        (draft.role === "merchant" || draft.role === "driver") ? (
                          <button
                            type="button"
                            onClick={() => void approve(user)}
                            disabled={working}
                            className="btn btn-primary btn-sm"
                            title={
                              draft.storeId || draft.driverId
                                ? "Approve and use the selected profile"
                                : "Approve and provision a new profile"
                            }
                          >
                            {working ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <ShieldCheck size={13} />
                            )}
                            Approve
                          </button>
                        ) : null}
                        {user.role !== "admin" ? (
                          <button
                            type="button"
                            onClick={() => void grantAdmin(user)}
                            disabled={working}
                            className="btn btn-ghost btn-sm"
                            title="Grant full operations access"
                          >
                            <ShieldCheck size={13} /> Grant admin
                          </button>
                        ) : adminCount > 1 ? (
                          <span className="text-[10px] font-medium text-muted">Admin</span>
                        ) : null}
                        {dirty ? (
                          <button
                            type="button"
                            onClick={() => void save(user)}
                            disabled={working || !complete}
                            className="btn btn-ghost btn-sm"
                          >
                            {working ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <ShieldCheck size={13} />
                            )}
                            Save
                          </button>
                        ) : null}
                        {status === "pending" ? (
                          <button
                            type="button"
                            onClick={() => void reject(user)}
                            disabled={working}
                            className="btn btn-ghost btn-sm text-danger"
                            title="Reject this account"
                          >
                            <ShieldX size={13} />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!ordered.length ? (
          <div className="px-4 py-10 text-center text-sm text-muted">
            No accounts match.
          </div>
        ) : null}
      </div>
    </section>
  );
}
