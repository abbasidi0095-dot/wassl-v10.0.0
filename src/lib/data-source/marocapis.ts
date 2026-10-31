import type {
  DataSourceStatus,
  RestaurantProvider,
  RestaurantRecord,
} from "./types";
import snapshotJson from "@/data/restaurants.locked.json";
import { getDataSourceStatus, verifySnapshotIntegrity } from "./locked";

type MarocApisPlace = {
  id: string;
  name?: { en?: string | null; fr?: string | null; ar?: string | null };
  slug?: string;
  city?: string;
  coordinates?: { latitude?: number; longitude?: number };
};

const known = new Map(
  (snapshotJson as unknown as { restaurants: RestaurantRecord[] }).restaurants.map(
    (restaurant) => [restaurant.externalId, restaurant],
  ),
);

function normalise(place: MarocApisPlace, citySlug: string): RestaurantRecord | null {
  const knownRecord = known.get(place.id);
  if (knownRecord) return knownRecord;

  const name = place.name?.en || place.name?.fr || place.name?.ar;
  const lat = place.coordinates?.latitude;
  const lng = place.coordinates?.longitude;
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    externalId: place.id,
    slug: place.slug || `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${place.id.slice(0, 6)}`,
    name,
    nameAr: place.name?.ar || "",
    citySlug,
    cuisine: "moroccan",
    lat: lat as number,
    lng: lng as number,
    address: `${citySlug} — new directory record`,
    phone: "",
    rating: 0,
    reviews: 0,
    priceLevel: 2,
    tags: ["New"],
    emoji: "🍲",
    accent: "#9a3412",
    tagline: "Newly listed on Wassl",
    description:
      "This establishment was just found in the MarocAPIs directory. A menu has not been published yet.",
    openingHours: [],
    distanceFromCentreKm: 0,
    coordinateVerified: false,
    source: "marocapis",
    enrichedBy: "marocapis",
    sourceUrl: null,
    verifiedAt: new Date().toISOString(),
    minOrder: 30,
    deliveryFee: 12,
    prepTime: 30,
  };
}

/**
 * Optional live directory provider. It refreshes establishment identity from
 * MarocAPIs; enrichment and menus stay locked until the importer is re-run,
 * so a provider outage can never change prices or menus mid-service.
 */
export const marocApisProvider: RestaurantProvider = {
  id: "marocapis-live",
  label: "MarocAPIs live directory",
  locked: false,
  async list(citySlug?: string) {
    const key = process.env.MAROCAPIS_API_KEY;
    if (!key) throw new Error("MAROCAPIS_API_KEY is not configured");
    const url = new URL("https://api.marocapis.com/api/v1/restaurants");
    if (citySlug) url.searchParams.set("city", citySlug);
    url.searchParams.set("limit", "50");

    const response = await fetch(url, {
      headers: { Accept: "application/json", "X-API-Key": key },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`MarocAPIs returned HTTP ${response.status}`);
    }
    const json = (await response.json()) as {
      data?: { items?: MarocApisPlace[] };
    };
    return (json.data?.items ?? [])
      .map((place) => normalise(place, citySlug || place.city || ""))
      .filter((record): record is RestaurantRecord => Boolean(record));
  },
  async status(): Promise<DataSourceStatus> {
    const base = getDataSourceStatus();
    return {
      ...base,
      configuredMode: "live",
      activeProvider: "marocapis-live",
      locked: false,
      integrity: verifySnapshotIntegrity(),
    };
  },
};
