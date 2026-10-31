import type { OpeningHours } from "@/lib/types";

/** A real establishment record, before it becomes a Wassl storefront. */
export type RestaurantRecord = {
  externalId: string;
  slug: string;
  name: string;
  nameAr: string;
  citySlug: string;
  cuisine: string;
  lat: number;
  lng: number;
  address: string;
  phone: string;
  rating: number;
  reviews: number;
  priceLevel: 1 | 2 | 3;
  tags: string[];
  emoji: string;
  accent: string;
  tagline: string;
  description: string;
  openingHours: OpeningHours[];
  distanceFromCentreKm: number;
  coordinateVerified: boolean;
  source: "marocapis" | "wassl";
  enrichedBy: "serpapi" | "marocapis" | "wassl";
  sourceUrl: string | null;
  verifiedAt: string;
  minOrder: number;
  deliveryFee: number;
  prepTime: number;
};

export type DataSourceId = "locked-snapshot" | "marocapis-live";

export type DataSourceStatus = {
  configuredMode: "locked" | "live";
  activeProvider: DataSourceId;
  locked: boolean;
  integrity: {
    ok: boolean;
    expected: string;
    actual: string;
  };
  generatedAt: string;
  restaurantCount: number;
  menuItemCount: number;
  cityCounts: Record<string, number>;
  sources: { id: string; name: string; url: string; role: string; license: string }[];
  notice: string;
  liveKeyConfigured: boolean;
};

export interface RestaurantProvider {
  id: DataSourceId;
  label: string;
  /** Locked providers refuse writes and report a sealed checksum. */
  locked: boolean;
  list(citySlug?: string): Promise<RestaurantRecord[]>;
  status(): Promise<DataSourceStatus>;
}
