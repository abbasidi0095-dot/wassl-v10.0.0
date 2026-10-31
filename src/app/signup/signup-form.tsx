"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Bike,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  ShoppingBag,
  Store,
} from "lucide-react";

type Role = "customer" | "merchant" | "driver";

const ROLES: {
  id: Role;
  label: string;
  hint: string;
  icon: typeof ShoppingBag;
}[] = [
  {
    id: "customer",
    label: "Customer",
    hint: "Order from local stores. Active immediately.",
    icon: ShoppingBag,
  },
  {
    id: "merchant",
    label: "Store owner",
    hint: "Sell on Wassl. Needs operations approval.",
    icon: Store,
  },
  {
    id: "driver",
    label: "Driver",
    hint: "Deliver with Wassl. Needs operations approval.",
    icon: Bike,
  },
];

type CityOption = { slug: string; name: string; priority: boolean };

export function SignupForm({
  initialRole,
  initialKind = "delivery",
  lockedRole = false,
  cities,
}: {
  initialRole: Role;
  initialKind?: "delivery" | "taxi" | "both";
  lockedRole?: boolean;
  cities: CityOption[];
}) {
  const router = useRouter();
  const [role, setRole] = useState<Role>(initialRole);
  const [kind, setKind] = useState<"delivery" | "taxi" | "both">(initialKind);
  const [plate, setPlate] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [citySlug, setCitySlug] = useState("dakhla");
  const [storeName, setStoreName] = useState("");
  const [vehicle, setVehicle] = useState(
    initialKind === "taxi" ? "Dacia Logan" : "Motorbike",
  );
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const southern = useMemo(() => cities.filter((city) => city.priority), [cities]);
  const others = useMemo(() => cities.filter((city) => !city.priority), [cities]);
  const selectedRole = ROLES.find((item) => item.id === role)!;

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordValid = password.length >= 8;
  const matches = password === confirm;
  const canSubmit =
    name.trim().length >= 2 &&
    emailValid &&
    passwordValid &&
    matches &&
    (role === "customer" || phone.trim().length > 0) &&
    (role !== "merchant" || storeName.trim().length > 0) &&
    (role !== "driver" || kind === "delivery" || plate.trim().length > 0);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          role,
          phone: phone || undefined,
          citySlug,
          storeName: role === "merchant" ? storeName : undefined,
          vehicle: role === "driver" ? vehicle : undefined,
          kind: role === "driver" ? kind : undefined,
          plate: role === "driver" ? plate : undefined,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        redirect?: string;
        needsApproval?: boolean;
        needsVerification?: boolean;
        email?: string;
      };
      if (!response.ok) {
        setError(data.error || "Could not create the account");
        return;
      }
      if (data.needsVerification) {
        const target =
          data.redirect ||
          `/verify-email?email=${encodeURIComponent(data.email || email.trim().toLowerCase())}`;
        router.push(target);
        return;
      }
      router.push(data.redirect || "/account");
      router.refresh();
    } catch {
      setError("Could not reach Wassl. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-6 sm:p-8">
      <div className="eyebrow">
        {role === "merchant"
          ? "Store partner"
          : role === "driver"
            ? kind === "taxi"
              ? "Taxi partner"
              : "Driver partner"
            : "Customer account"}
      </div>
      <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">
        {role === "merchant"
          ? "Open your store"
          : role === "driver"
            ? "Drive with Wassl"
            : "Join Wassl"}
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-bold text-brand hover:text-brand-dark">
          Sign in
        </Link>
        .
      </p>

      {!lockedRole ? (
        <>
      <div className="mt-5 grid grid-cols-3 gap-2">
        {ROLES.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setRole(item.id);
                setError("");
              }}
              className={`rounded-[6px] px-2 py-2.5 text-[11px] font-semibold transition ${
                role === item.id
                  ? "bg-brand text-on-dark shadow-sm"
                  : "bg-surface-2 text-muted hover:bg-ink/5"
              }`}
            >
              <Icon size={15} className="mx-auto mb-1" />
              {item.label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] font-semibold text-muted">
        {selectedRole.hint}
      </p>
        </>
      ) : (
        <p className="mt-3 text-[11px] font-semibold text-muted">
          {selectedRole.hint}
        </p>
      )}

      <form onSubmit={submit} className="mt-5 space-y-4">
        <label className="block">
          <span className="label">Full name</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="input"
            placeholder="Your name"
            autoComplete="name"
            required
          />
        </label>

        <label className="block">
          <span className="label">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="input"
            placeholder="you@example.ma"
            autoComplete="email"
            required
          />
          <span className="mt-1 block text-[11px] text-muted">
            We will send a 6-digit code to confirm this address.
          </span>
        </label>

        <label className="block">
          <span className="label">
            Phone{" "}
            {role === "customer" ? (
              <span className="font-normal text-muted">(for delivery updates)</span>
            ) : null}
          </span>
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="input"
            placeholder="+212 6.. .. .. .."
            autoComplete="tel"
            required={role !== "customer"}
          />
        </label>

        <label className="block">
          <span className="label">City</span>
          <select
            value={citySlug}
            onChange={(event) => setCitySlug(event.target.value)}
            className="input"
            required={role !== "customer"}
          >
            <optgroup label="Southern Morocco">
              {southern.map((city) => (
                <option key={city.slug} value={city.slug}>
                  {city.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="All Morocco">
              {others.map((city) => (
                <option key={city.slug} value={city.slug}>
                  {city.name}
                </option>
              ))}
            </optgroup>
          </select>
        </label>

        {role === "merchant" ? (
          <label className="block">
            <span className="label">Store name</span>
            <input
              type="text"
              value={storeName}
              onChange={(event) => setStoreName(event.target.value)}
              className="input"
              placeholder="e.g. Dakhla Grill"
              required
            />
            <span className="mt-1 block text-[11px] text-muted">
              We use this to set up your storefront when operations approves you.
            </span>
          </label>
        ) : null}

        {role === "driver" ? (
          <>
            <label className="block">
              <span className="label">Works as</span>
              <select
                value={kind}
                onChange={(event) => {
                  const next = event.target.value as "delivery" | "taxi" | "both";
                  setKind(next);
                  if (next !== "delivery" && vehicle === "Motorbike") {
                    setVehicle("Dacia Logan");
                  }
                }}
                className="input"
              >
                <option value="delivery">Delivery courier</option>
                <option value="taxi">Taxi driver</option>
                <option value="both">Delivery + taxi</option>
              </select>
            </label>
            <label className="block">
              <span className="label">Vehicle</span>
              <select
                value={vehicle}
                onChange={(event) => setVehicle(event.target.value)}
                className="input"
              >
                <option>Motorbike</option>
                <option>Bicycle</option>
                <option>Dacia Logan</option>
                <option>Renault Clio</option>
                <option>Peugeot 208</option>
                <option>Mercedes W123</option>
                <option>Toyota Prius</option>
                <option>Other</option>
              </select>
            </label>
            {kind !== "delivery" ? (
              <label className="block">
                <span className="label">Plate number</span>
                <input
                  value={plate}
                  onChange={(event) => setPlate(event.target.value)}
                  className="input uppercase"
                  placeholder="12345-A-6"
                  required
                />
              </label>
            ) : null}
          </>
        ) : null}

        <label className="block">
          <span className="label">Password</span>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="input pe-11"
              placeholder="At least 8 characters"
              autoComplete="new-password"
              minLength={8}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {password && !passwordValid ? (
            <span className="mt-1 block text-[11px] font-bold text-coral">
              Use at least 8 characters.
            </span>
          ) : null}
        </label>

        <label className="block">
          <span className="label">Confirm password</span>
          <input
            type={showPassword ? "text" : "password"}
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            className="input"
            placeholder="Repeat your password"
            autoComplete="new-password"
            required
          />
          {confirm && !matches ? (
            <span className="mt-1 block text-[11px] font-bold text-coral">
              Passwords do not match.
            </span>
          ) : null}
        </label>

        {error ? (
          <p className="rounded-[6px] bg-danger-soft px-3 py-2 text-xs font-bold text-danger">
            {error}
          </p>
        ) : null}

        {role !== "customer" ? (
          <p className="flex items-start gap-2 rounded-[6px] bg-saffron/10 px-3 py-2 text-[11px] font-semibold leading-5 text-saffron-deep">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
            Your account starts as pending. You can sign in, but your workspace
            unlocks only after a Wassl operator approves it.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit || loading}
          className="btn btn-primary w-full disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
          {loading ? "Creating your account…" : "Create account"}
        </button>
      </form>
    </div>
  );
}
