"use client";

import { useEffect } from "react";
import { CITY_COOKIE } from "@/lib/city-cookie";

/** Visiting a city page makes that city the default on this device. */
export function CityPreferenceSync({ slug }: { slug: string }) {
  useEffect(() => {
    document.cookie = `${CITY_COOKIE}=${encodeURIComponent(slug)}; path=/; max-age=31536000; samesite=lax`;
  }, [slug]);
  return null;
}
