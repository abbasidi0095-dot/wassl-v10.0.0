import { describe, expect, it } from "vitest";
import {
  cityServiceEnabled,
  cityServices,
  defaultCityServices,
  sanitizeCityServices,
} from "@/lib/city-services";
import type { City } from "@/lib/types";

const liveCity: City = {
  id: "city_dakhla",
  slug: "dakhla",
  name: "Dakhla",
  nameAr: "الداخلة",
  lat: 23.68,
  lng: -15.95,
  population: 100000,
  region: "Dakhla-Oued Ed-Dahab",
  priority: true,
  active: true,
  launchStatus: "live",
};

describe("city service activation", () => {
  it("enables the existing three services for a live city", () => {
    expect(defaultCityServices(liveCity)).toEqual({
      restaurant: true,
      grocery: true,
      taxi: true,
      express: true,
      services: true,
      business: true,
    });
  });

  it("keeps new services disabled for a soon city", () => {
    const soon = { ...liveCity, launchStatus: "soon" as const };
    expect(typeof defaultCityServices(soon)).toBe("object");
    expect(Object.values(defaultCityServices(soon)).some(Boolean)).toBe(false);
  });

  it("merges an operator override without dropping other services", () => {
    const city: City = {
      ...liveCity,
      services: { express: true, grocery: false },
    };
    expect(cityServiceEnabled(city, "restaurant")).toBe(true);
    expect(cityServiceEnabled(city, "grocery")).toBe(false);
    expect(cityServiceEnabled(city, "express")).toBe(true);
    expect(cityServiceEnabled(city, "services")).toBe(true);
  });

  it("rejects unknown keys and non-boolean values", () => {
    expect(
      sanitizeCityServices({
        grocery: false,
        express: true,
        taxi: "yes",
        unknown: true,
      }),
    ).toEqual({ grocery: false, express: true });
  });

  it("returns a complete record for callers", () => {
    expect(Object.keys(cityServices(liveCity)).sort()).toEqual(
      ["business", "express", "grocery", "restaurant", "services", "taxi"].sort(),
    );
  });
});
