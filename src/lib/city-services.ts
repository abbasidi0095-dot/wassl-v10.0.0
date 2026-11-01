import type { City, CityService } from "./types";

export const CITY_SERVICES: Array<{
  id: CityService;
  label: string;
  description: string;
}> = [
  {
    id: "restaurant",
    label: "Restaurants",
    description: "Food, cafés and late-night kitchens",
  },
  {
    id: "grocery",
    label: "Grocery",
    description: "Supermarkets, aisles and pickup",
  },
  {
    id: "taxi",
    label: "Taxi",
    description: "Local rides, cash fare and handover",
  },
  {
    id: "express",
    label: "Express",
    description: "Parcels and document delivery",
  },
  {
    id: "services",
    label: "Local services",
    description: "Laundry, cleaning, repairs and bookings",
  },
  {
    id: "business",
    label: "Business",
    description: "Wholesale and B2B ordering",
  },
];

const SERVICE_IDS = new Set<CityService>(CITY_SERVICES.map((entry) => entry.id));

/** A live city starts with the existing three services enabled. */
export function defaultCityServices(
  city: Pick<City, "launchStatus" | "active">,
): Record<CityService, boolean> {
  const live = city.launchStatus === "live" && city.active;
  return {
    restaurant: live,
    grocery: live,
    taxi: live,
    express: live,
    services: false,
    business: false,
  };
}

export function cityServices(city: City): Record<CityService, boolean> {
  return { ...defaultCityServices(city), ...(city.services ?? {}) };
}

export function cityServiceEnabled(city: City | undefined, service: CityService): boolean {
  if (!city) return false;
  return cityServices(city)[service];
}

/** Keep only known service ids and boolean values. */
export function sanitizeCityServices(
  input: unknown,
): Partial<Record<CityService, boolean>> {
  if (!input || typeof input !== "object") return {};
  const result: Partial<Record<CityService, boolean>> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!SERVICE_IDS.has(key as CityService)) continue;
    if (typeof value !== "boolean") continue;
    result[key as CityService] = value;
  }
  return result;
}
