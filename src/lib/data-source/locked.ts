import crypto from "node:crypto";
import snapshotJson from "@/data/restaurants.locked.json";
import { MENUS } from "@/data/menu-catalog";
import type {
  DataSourceStatus,
  RestaurantProvider,
  RestaurantRecord,
} from "./types";

type Snapshot = {
  version: number;
  locked: boolean;
  generatedAt: string;
  citySlugs: string[];
  sources: DataSourceStatus["sources"];
  notice: string;
  checksum: string;
  restaurants: RestaurantRecord[];
};

const snapshot = snapshotJson as unknown as Snapshot;

/**
 * Stable JSON used by both the importer and the runtime verifier. Sorting keys
 * means the checksum does not depend on property order.
 */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .filter((key) => record[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(restaurants: RestaurantRecord[]): string {
  return crypto.createHash("sha256").update(canonical(restaurants)).digest("hex");
}

export function verifySnapshotIntegrity(): DataSourceStatus["integrity"] {
  const actual = digest(snapshot.restaurants);
  return { ok: actual === snapshot.checksum, expected: snapshot.checksum, actual };
}

export function getSnapshot() {
  return snapshot;
}

function countMenus(): number {
  return snapshot.restaurants.reduce(
    (sum, restaurant) => sum + (MENUS[restaurant.cuisine]?.length ?? 0),
    0,
  );
}

export function getDataSourceStatus(): DataSourceStatus {
  const cityCounts: Record<string, number> = {};
  for (const restaurant of snapshot.restaurants) {
    cityCounts[restaurant.citySlug] = (cityCounts[restaurant.citySlug] ?? 0) + 1;
  }
  return {
    configuredMode: process.env.RESTAURANT_DATA_SOURCE === "live" ? "live" : "locked",
    activeProvider: "locked-snapshot",
    locked: true,
    integrity: verifySnapshotIntegrity(),
    generatedAt: snapshot.generatedAt,
    restaurantCount: snapshot.restaurants.length,
    menuItemCount: countMenus(),
    cityCounts,
    sources: snapshot.sources,
    notice: snapshot.notice,
    liveKeyConfigured: Boolean(process.env.MAROCAPIS_API_KEY),
  };
}

export const lockedSnapshotProvider: RestaurantProvider = {
  id: "locked-snapshot",
  label: "Locked snapshot (MarocAPIs + SerpApi)",
  locked: true,
  async list(citySlug?: string) {
    if (!citySlug) return snapshot.restaurants;
    return snapshot.restaurants.filter(
      (restaurant) => restaurant.citySlug === citySlug,
    );
  },
  async status() {
    return getDataSourceStatus();
  },
};
