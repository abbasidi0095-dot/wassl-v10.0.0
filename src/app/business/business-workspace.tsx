"use client";

import { useMemo, useState } from "react";
import { Building2, CheckCircle2, Loader2 } from "lucide-react";
import type {
  BusinessAccount,
  BusinessOrder,
  City,
  Product,
  Store,
} from "@/lib/types";
import { money } from "@/lib/utils";
import { useI18n } from "@/components/locale-provider";

type CatalogStore = { store: Store; products: Product[] };

export function BusinessWorkspace({
  cities,
  account: initialAccount,
  catalog,
  initialOrders,
  defaultCity,
}: {
  cities: City[];
  account: BusinessAccount | null;
  catalog: CatalogStore[];
  initialOrders: BusinessOrder[];
  defaultCity: string;
}) {
  const { t } = useI18n();
  const [account, setAccount] = useState(initialAccount);
  const [orders, setOrders] = useState(initialOrders);
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("Restaurant");
  const [citySlug, setCitySlug] = useState(defaultCity);
  const [storeId, setStoreId] = useState(catalog[0]?.store.id ?? "");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selected = catalog.find((entry) => entry.store.id === storeId);
  const lines = useMemo(
    () =>
      (selected?.products ?? [])
        .map((product) => {
          const qty = Number(quantities[product.id] ?? 0);
          const price = product.businessPrice ?? Math.max(1, Math.round(product.price * 0.9));
          return qty > 0 ? { product, qty, price, total: qty * price } : null;
        })
        .filter((line): line is NonNullable<typeof line> => Boolean(line)),
    [selected, quantities],
  );
  const subtotal = lines.reduce((sum, line) => sum + line.total, 0);

  async function apply(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/business/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          contactName,
          phone,
          email,
          citySlug,
          category,
        }),
      });
      const data = (await response.json()) as {
        account?: BusinessAccount;
        error?: string;
      };
      if (!response.ok || !data.account) {
        setError(data.error || t("Could not submit the application."));
        return;
      }
      setAccount(data.account);
      setSuccess(t("Application received. Operations will review it."));
    } finally {
      setLoading(false);
    }
  }

  async function submitOrder(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !lines.length || !deliveryDate) {
      setError(t("Choose products and a delivery date."));
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/business/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: selected.store.id,
          deliveryDate,
          notes,
          items: lines.map((line) => ({ productId: line.product.id, qty: line.qty })),
        }),
      });
      const data = (await response.json()) as {
        order?: BusinessOrder;
        error?: string;
      };
      if (!response.ok || !data.order) {
        setError(data.error || t("Could not create the order."));
        return;
      }
      setOrders((current) => [data.order!, ...current]);
      setQuantities({});
      setDeliveryDate("");
      setNotes("");
      setSuccess(t("Wholesale order {code} requested.", { code: data.order.code }));
    } finally {
      setLoading(false);
    }
  }

  if (!account) {
    return (
      <form onSubmit={apply} className="aero-tile max-w-2xl rounded-[10px] border p-5">
        <div className="flex items-center gap-2">
          <Building2 size={17} className="text-brand" />
          <h2 className="text-[15px] font-semibold">{t("Apply for a business account")}</h2>
        </div>
        <p className="mt-1 text-[11px] text-muted">
          {t("Wholesale prices for restaurants, cafés, shops, hotels and offices. Cash settlement.")}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">{t("Company name")}</span>
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="input" required />
          </label>
          <label className="block">
            <span className="label">{t("Contact name")}</span>
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} className="input" required />
          </label>
          <label className="block">
            <span className="label">{t("Phone")}</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" required />
          </label>
          <label className="block">
            <span className="label">{t("Email")}</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="label">{t("City")}</span>
            <select value={citySlug} onChange={(e) => setCitySlug(e.target.value)} className="input">
              {cities.map((city) => (
                <option key={city.slug} value={city.slug}>{city.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">{t("Business type")}</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
              {["Restaurant", "Café", "Shop", "Hotel", "Office", "Other"].map((value) => (
                <option key={value} value={value}>{t(value)}</option>
              ))}
            </select>
          </label>
        </div>
        {error ? <p className="mt-3 text-[11px] text-danger">{error}</p> : null}
        <button type="submit" disabled={loading} className="btn btn-primary mt-4 disabled:opacity-40">
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Building2 size={13} />}
          {t("Submit application")}
        </button>
      </form>
    );
  }

  if (account.status !== "approved") {
    return (
      <div className="aero-tile max-w-2xl rounded-[10px] border p-6 text-center">
        <Building2 size={24} className="mx-auto text-brand" />
        <h2 className="mt-3 text-[18px] font-semibold">{account.companyName}</h2>
        <p className="mt-1 text-[12px] text-muted">
          {account.status === "pending"
            ? t("Your business account is waiting for operations approval.")
            : t("This business account was rejected. Contact support for help.")}
        </p>
        {success ? <p className="mt-2 text-[11px] text-success">{success}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] text-muted">{t("Business account")}</div>
          <div className="text-[16px] font-semibold">{account.companyName}</div>
        </div>
        <span className="pill">{t("Approved")}</span>
      </div>

      <form onSubmit={submitOrder} className="aero-tile rounded-[10px] border p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">{t("Wholesale store")}</span>
            <select
              value={storeId}
              onChange={(event) => {
                setStoreId(event.target.value);
                setQuantities({});
              }}
              className="input"
            >
              {catalog.map((entry) => (
                <option key={entry.store.id} value={entry.store.id}>
                  {entry.store.name} · {entry.store.citySlug}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">{t("Delivery date")}</span>
            <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="input" required />
          </label>
        </div>

        <div className="mt-4 divide-y divide-line border-y border-line">
          {(selected?.products ?? []).slice(0, 30).map((product) => {
            const price = product.businessPrice ?? Math.max(1, Math.round(product.price * 0.9));
            return (
              <div key={product.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-semibold">{product.name}</div>
                  <div className="text-[10px] text-muted">
                    {product.unit || t("each")} · {money(price)} · {t("min")} {product.businessMinQty ?? 1}
                  </div>
                </div>
                <input
                  type="number"
                  min={0}
                  value={quantities[product.id] ?? ""}
                  onChange={(event) =>
                    setQuantities((current) => ({ ...current, [product.id]: event.target.value }))
                  }
                  className="input h-8 w-20 text-[11px]"
                  placeholder="0"
                  aria-label={t("Quantity for {name}", { name: product.name })}
                />
              </div>
            );
          })}
        </div>

        <label className="mt-3 block">
          <span className="label">{t("Notes")}</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="input" />
        </label>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[13px] font-semibold tnum">
            {t("Estimated wholesale total")}: {money(subtotal)}
          </div>
          <button type="submit" disabled={loading} className="btn btn-primary disabled:opacity-40">
            {loading ? <Loader2 size={13} className="animate-spin" /> : null}
            {t("Request wholesale order")}
          </button>
        </div>
        {error ? <p className="mt-2 text-[11px] text-danger">{error}</p> : null}
        {success ? (
          <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-success">
            <CheckCircle2 size={12} /> {success}
          </p>
        ) : null}
      </form>

      <section>
        <h2 className="text-[13px] font-semibold">{t("Business orders")}</h2>
        <div className="mt-2 space-y-2">
          {orders.map((order) => (
            <div key={order.id} className="aero-tile rounded-[8px] border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[12px] font-semibold">{order.code}</div>
                  <div className="text-[10px] text-muted">
                    {order.items.length} {t("lines")} · {order.deliveryDate}
                  </div>
                </div>
                <div className="text-end">
                  <div className="text-[12px] font-semibold tnum">{money(order.subtotal)}</div>
                  <div className="text-[10px] text-muted capitalize">{t(order.status)}</div>
                </div>
              </div>
            </div>
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
