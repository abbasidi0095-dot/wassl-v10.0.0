import { getDataSourceStatus, lockedSnapshotProvider, verifySnapshotIntegrity } from "./locked";
import { marocApisProvider } from "./marocapis";
import type { RestaurantProvider } from "./types";

export function getRestaurantProvider(): RestaurantProvider {
  return process.env.RESTAURANT_DATA_SOURCE === "live"
    ? marocApisProvider
    : lockedSnapshotProvider;
}

/**
 * Writes are only legal against a sealed snapshot. Call this before any
 * operation that would mutate imported catalogue data.
 */
export function assertSnapshotWritable(): void {
  const integrity = verifySnapshotIntegrity();
  if (!integrity.ok) {
    throw new Error(
      "The locked restaurant snapshot failed its integrity check. Re-run the importer before serving data.",
    );
  }
  if (getRestaurantProvider().locked) {
    throw new Error(
      "Restaurant and menu data is locked. Re-run scripts/import-restaurants.mjs to publish a new snapshot.",
    );
  }
}

export { getDataSourceStatus, verifySnapshotIntegrity };
export type { RestaurantProvider, RestaurantRecord, DataSourceStatus } from "./types";
