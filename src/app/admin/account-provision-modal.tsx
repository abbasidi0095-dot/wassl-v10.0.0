"use client";

import { useMemo, useRef, useState } from "react";
import {
  Bike,
  CarTaxiFront,
  Check,
  Copy,
  KeyRound,
  Loader2,
  Store,
  Upload,
  UserPlus,
  X,
} from "lucide-react";
import type { City, Driver, Store as StoreType } from "@/lib/types";
import { cn } from "@/lib/utils";

const VEHICLES = [
  "Motorbike",
  "Bicycle",
  "Dacia Logan",
  "Renault Clio",
  "Peugeot 208",
  "Mercedes W123",
  "Toyota Prius",
  "Other",
];

export async function resizePhoto(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the photo"));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("Could not read the photo"));
    element.src = dataUrl;
  });
  const size = 320;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return dataUrl;
  const scale = Math.max(size / image.width, size / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export function AccountProvisionModal({
  cities,
  stores,
  defaultRole = "driver",
  defaultStoreId,
  onClose,
  onCreated,
}: {
  cities: City[];
  stores: StoreType[];
  defaultRole?: "driver" | "merchant";
  defaultStoreId?: string;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const [role, setRole] = useState<"driver" | "merchant">(defaultRole);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [citySlug, setCitySlug] = useState(
    cities.find((city) => city.priority)?.slug ?? cities[0]?.slug ?? "dakhla",
  );
  const [kind, setKind] = useState<"delivery" | "taxi" | "both">("delivery");
  const [vehicle, setVehicle] = useState("Motorbike");
  const [plate, setPlate] = useState("");
  const [photo, setPhoto] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [storeId, setStoreId] = useState(defaultStoreId ?? stores[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [credentials, setCredentials] = useState<{
    email: string;
    password: string;
    label: string;
  } | null>(null);
  const [copied, setCopied] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const store = useMemo(
    () => stores.find((candidate) => candidate.id === storeId),
    [storeId, stores],
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          name,
          phone,
          citySlug,
          kind,
          vehicle,
          plate,
          photo,
          email: email.trim() || undefined,
          password: password.trim() || undefined,
          storeId: role === "merchant" ? storeId : undefined,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        email?: string;
        password?: string;
        driver?: Driver;
        store?: StoreType;
      };
      if (!response.ok || !data.email || !data.password) {
        setError(data.error || "Could not create the account");
        return;
      }
      setCredentials({
        email: data.email,
        password: data.password,
        label:
          role === "driver"
            ? `${data.driver?.name ?? name} · ${data.driver?.vehicle ?? vehicle}`
            : `${data.store?.name ?? store?.name ?? "Store"} · store login`,
      });
      await onCreated();
    } catch {
      setError("Could not reach the server");
    } finally {
      setSaving(false);
    }
  }

  async function pickPhoto(file?: File) {
    if (!file) return;
    try {
      setPhoto(await resizePhoto(file));
    } catch {
      setError("Could not read that photo");
    }
  }

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(""), 1800);
    } catch {
      setCopied("");
    }
  }

  if (credentials) {
    return (
      <div className="fixed inset-0 z-[80] grid place-items-center bg-ink/55 p-4">
        <div className="w-full max-w-md rounded-[12px] bg-surface p-5 shadow-[var(--shadow-float)]">
          <div className="flex items-start justify-between gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-[8px] bg-brand-soft text-brand">
              <KeyRound size={18} />
            </span>
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-[6px] text-muted hover:bg-surface-2 hover:text-ink"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
          <h2 className="mt-4 font-display text-[24px] font-semibold tracking-[-0.03em]">
            Account created
          </h2>
          <p className="mt-1 text-[12px] text-muted">
            {credentials.label}. Share these credentials once — the password is not
            stored in readable form.
          </p>
          <div className="mt-4 space-y-3">
            {[
              { key: "email", label: "Login", value: credentials.email },
              { key: "password", label: "Password", value: credentials.password },
            ].map((row) => (
              <div key={row.key} className="rounded-[8px] border border-line bg-surface-2/60 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                  {row.label}
                </div>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <code className="break-all text-[13px] font-semibold text-ink">
                    {row.value}
                  </code>
                  <button
                    type="button"
                    onClick={() => void copy(row.value, row.key)}
                    className="btn btn-ghost btn-sm shrink-0"
                  >
                    {copied === row.key ? (
                      <Check size={12} className="text-success" />
                    ) : (
                      <Copy size={12} />
                    )}
                    {copied === row.key ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={onClose} className="btn btn-primary mt-5 w-full">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-ink/55 p-4"
      role="presentation"
      onClick={onClose}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Create an account"
        className="my-6 w-full max-w-xl rounded-[12px] bg-surface p-5 shadow-[var(--shadow-float)]"
        onClick={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-[24px] font-semibold tracking-[-0.03em]">
              Create an account
            </h2>
            <p className="mt-1 text-[11px] leading-5 text-muted">
              Provision a driver or a store login. Leave email and password blank to
              generate them.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-[6px] text-muted hover:bg-surface-2 hover:text-ink"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {[
            { id: "driver" as const, label: "Driver", icon: Bike },
            { id: "merchant" as const, label: "Store owner", icon: Store },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setRole(item.id)}
              className={cn(
                "flex items-center gap-2 rounded-[6px] border px-3 py-2.5 text-[12px] font-semibold transition-colors",
                role === item.id
                  ? "border-ink bg-ink text-on-dark"
                  : "border-line bg-surface text-muted hover:text-ink",
              )}
            >
              <item.icon size={15} />
              {item.label}
            </button>
          ))}
        </div>

        {role === "driver" ? (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="label">Full name</span>
                <input
                  className="input"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Youssef El Amrani"
                  required
                  autoFocus
                />
              </label>
              <label className="block">
                <span className="label">Phone</span>
                <input
                  className="input"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+212 6 12 34 56 78"
                  required
                />
              </label>
              <label className="block">
                <span className="label">City</span>
                <select
                  className="input"
                  value={citySlug}
                  onChange={(event) => setCitySlug(event.target.value)}
                >
                  {cities.map((city) => (
                    <option key={city.slug} value={city.slug}>
                      {city.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="label">Works as</span>
                <select
                  className="input"
                  value={kind}
                  onChange={(event) =>
                    setKind(event.target.value as "delivery" | "taxi" | "both")
                  }
                >
                  <option value="delivery">Delivery courier</option>
                  <option value="taxi">Taxi driver</option>
                  <option value="both">Delivery + taxi</option>
                </select>
              </label>
              <label className="block">
                <span className="label">Vehicle</span>
                <select
                  className="input"
                  value={vehicle}
                  onChange={(event) => setVehicle(event.target.value)}
                >
                  {VEHICLES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="label">
                  Plate {kind === "delivery" ? "(optional)" : ""}
                </span>
                <input
                  className="input uppercase"
                  value={plate}
                  onChange={(event) => setPlate(event.target.value)}
                  placeholder="12345-A-6"
                />
              </label>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[8px] border border-line p-3">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo}
                  alt="Driver preview"
                  className="h-14 w-14 rounded-[8px] object-cover"
                />
              ) : (
                <span className="grid h-14 w-14 place-items-center rounded-[8px] bg-surface-2 text-muted">
                  <CarTaxiFront size={20} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold">Driver photo</div>
                <div className="text-[11px] text-muted">
                  Shown in dispatch and when the driver accepts a ride.
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => void pickPhoto(event.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="btn btn-ghost btn-sm"
              >
                <Upload size={12} /> Upload
              </button>
            </div>
          </>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="label">Store</span>
              <select
                className="input"
                value={storeId}
                onChange={(event) => setStoreId(event.target.value)}
                required
              >
                <option value="">Choose a store…</option>
                {stores.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {item.citySlug}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">Owner name</span>
              <input
                className="input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={store?.ownerName || "Store owner"}
              />
            </label>
            <label className="block">
              <span className="label">Phone</span>
              <input
                className="input"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder={store?.phone}
              />
            </label>
          </div>
        )}

        <div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">Login email (optional)</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Generated automatically"
            />
          </label>
          <label className="block">
            <span className="label">Password (optional)</span>
            <input
              className="input"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Generated automatically"
            />
          </label>
        </div>

        {error ? (
          <p className="mt-3 rounded-[6px] bg-danger-soft px-3 py-2 text-[11px] font-medium text-danger">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost flex-1">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn btn-primary flex-1">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
            {saving ? "Creating…" : "Create account"}
          </button>
        </div>
      </form>
    </div>
  );
}
