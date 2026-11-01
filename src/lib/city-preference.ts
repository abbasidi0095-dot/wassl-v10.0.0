import { cookies } from "next/headers";
import { getSession } from "./auth";
import { getUserById } from "./db";
import type { City } from "./types";
import { CITY_COOKIE } from "./city-cookie";

/**
 * The city switcher writes this cookie; the account city is the fallback for a
 * customer who has not picked a city on this device yet.
 */
export async function preferredCitySlug(): Promise<string | null> {
  const value = (await cookies()).get(CITY_COOKIE)?.value;
  if (value) return value;

  const session = await getSession();
  if (!session?.userId) return null;
  const user = await getUserById(session.userId);
  return user?.citySlug ?? null;
}

export async function getPreferredCity(cities: City[]): Promise<City> {
  const slug = await preferredCitySlug();
  return (
    cities.find((city) => city.slug === slug) ??
    cities.find((city) => city.slug === "dakhla") ??
    cities[0]
  );
}
