import { getOpenState, casablancaNow } from "./hours";
import type { GrocerySettings, Product, Store } from "./types";

export type GroceryAvailability = {
  open: boolean;
  delivery: boolean;
  pickup: boolean;
  express: boolean;
  scheduling: boolean;
  night: boolean;
  reason: string;
  label: string;
  detail: string;
};

export function defaultGrocerySettings(store: Store): GrocerySettings {
  return {
    expressEnabled: false,
    expressFee: 10,
    expressMinutes: 30,
    pickupEnabled: true,
    alwaysOpen: false,
    overnightStaffed: false,
    nightStart: "23:00",
    nightEnd: "06:00",
    nightFee: 8,
    schedulingEnabled: true,
    scheduleSlots: ["09:00", "12:00", "15:00", "18:00", "21:00"],
    deliveryZones: [
      {
        id: "city",
        name: "City centre",
        maxKm: 20,
        fee: store.deliveryFee,
        minOrder: store.minOrder,
      },
    ],
    substitutionDefault: "allow",
    lowStockThreshold: 5,
    loyaltyPointsPer10Mad: 1,
  };
}

/** Never trusts a partial stored settings object; old stores get safe defaults. */
export function grocerySettings(store: Store): GrocerySettings {
  const defaults = defaultGrocerySettings(store);
  const stored = store.grocery;
  if (!stored) return defaults;
  return {
    ...defaults,
    ...stored,
    deliveryZones:
      Array.isArray(stored.deliveryZones) && stored.deliveryZones.length
        ? stored.deliveryZones
        : defaults.deliveryZones,
    scheduleSlots:
      Array.isArray(stored.scheduleSlots) && stored.scheduleSlots.length
        ? stored.scheduleSlots
        : defaults.scheduleSlots,
  };
}

export function isNightNow(settings: GrocerySettings, now = new Date()): boolean {
  const current = casablancaNow(now).minutes;
  const [startH, startM] = settings.nightStart.split(":").map(Number);
  const [endH, endM] = settings.nightEnd.split(":").map(Number);
  const start = startH * 60 + (startM || 0);
  const end = endH * 60 + (endM || 0);
  if (start === end) return false;
  if (end < start) return current >= start || current < end;
  return current >= start && current < end;
}

/**
 * Honest availability: 24/7 ordering never implies 24/7 delivery. Night
 * delivery/pickup requires overnight staffing; delivery requires a driver in
 * the city unless the order is scheduled for later.
 */
export function groceryAvailability(
  store: Store,
  activeDrivers: number,
  now = new Date(),
): GroceryAvailability {
  const settings = grocerySettings(store);
  const hours = getOpenState(store, now);
  const open = store.isOpen && (settings.alwaysOpen || hours.open);
  const night = isNightNow(settings, now);
  const staffed = !night || settings.overnightStaffed;
  const delivery = open && staffed && activeDrivers > 0;
  const pickup = open && staffed && settings.pickupEnabled;
  const express = delivery && settings.expressEnabled && !night;
  const scheduling = settings.schedulingEnabled;

  let reason = "";
  if (!open) reason = hours.detail || "Store is closed";
  else if (night && !settings.overnightStaffed) {
    reason = "Overnight delivery is not staffed right now";
  } else if (!delivery && activeDrivers === 0) {
    reason = "No drivers are online — pickup is still available";
  } else if (night) {
    reason = "Night delivery is active (night fee applies)";
  }

  const label = !open
    ? "Closed"
    : night
      ? "Open overnight"
      : hours.label;
  const detail = reason || hours.detail || `Ready in about ${store.prepTime} min`;

  return { open, delivery, pickup, express, scheduling, night, reason, label, detail };
}

export function zoneForDistance(
  store: Store,
  distanceKm: number,
): { fee: number; minOrder: number; zoneName: string } | null {
  const settings = grocerySettings(store);
  const sorted = [...settings.deliveryZones].sort((a, b) => a.maxKm - b.maxKm);
  const zone = sorted.find((entry) => distanceKm <= entry.maxKm);
  if (!zone) return null;
  return { fee: zone.fee, minOrder: zone.minOrder, zoneName: zone.name };
}

export function groceryFees({
  store,
  distanceKm,
  express,
  now = new Date(),
}: {
  store: Store;
  distanceKm: number;
  express: boolean;
  now?: Date;
}) {
  const settings = grocerySettings(store);
  const zone = zoneForDistance(store, distanceKm);
  if (!zone) return null;
  const night = isNightNow(settings, now);
  const expressFee = express ? settings.expressFee : 0;
  const nightFee = night ? settings.nightFee : 0;
  return {
    deliveryFee: Math.round(zone.fee + expressFee + nightFee),
    minOrder: zone.minOrder,
    zoneName: zone.zoneName,
    night,
    nightFee,
    expressFee,
  };
}

export type ResolvedStock = {
  stock: number | undefined;
  price: number;
  label?: string;
  sku?: string;
  unit?: string;
};

export function resolveProductStock(
  product: Product,
  variantId?: string,
): ResolvedStock | null {
  if (variantId) {
    const variant = product.variants?.find((item) => item.id === variantId);
    if (!variant) return null;
    return {
      stock: variant.stock,
      price: variant.price,
      label: variant.label,
      sku: variant.sku,
      unit: variant.unit || product.unit,
    };
  }
  return {
    stock: product.stock,
    price: product.price,
    sku: product.sku,
    unit: product.unit,
  };
}

export function stockBadge(stock: number | undefined, threshold = 5): {
  tone: "out" | "low" | "ok" | "unlimited";
  label: string;
} {
  if (stock === undefined) return { tone: "unlimited", label: "In stock" };
  if (stock <= 0) return { tone: "out", label: "Sold out" };
  if (stock <= threshold) return { tone: "low", label: `Only ${stock} left` };
  return { tone: "ok", label: "In stock" };
}

export function haversineKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const radius = 6371;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(a));
}

export function nextScheduleSlot(store: Store, now = new Date()): string | null {
  const settings = grocerySettings(store);
  if (!settings.schedulingEnabled) return null;
  const nowMinutes = casablancaNow(now).minutes;
  for (const slot of [...settings.scheduleSlots].sort()) {
    const [hour, minute] = slot.split(":").map(Number);
    if (hour * 60 + (minute || 0) > nowMinutes + 30) return slot;
  }
  return settings.scheduleSlots[0] ?? null;
}
