import type { TaxiStatus } from "./types";

export const TAXI_BASE_FARE = 15;
export const TAXI_PER_KM = 5;
export const TAXI_MIN_FARE = 25;

export const TAXI_TRANSITIONS: Record<TaxiStatus, TaxiStatus[]> = {
  requested: ["accepted", "cancelled"],
  accepted: ["arriving", "cancelled"],
  arriving: ["in_progress", "cancelled"],
  in_progress: ["completed"],
  completed: [],
  cancelled: [],
};

export const TAXI_ACTIVE_STATUSES: TaxiStatus[] = [
  "requested",
  "accepted",
  "arriving",
  "in_progress",
];

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

export function estimateTaxiFare(distanceKm: number): number {
  return Math.max(
    TAXI_MIN_FARE,
    Math.round(TAXI_BASE_FARE + Math.max(0, distanceKm) * TAXI_PER_KM),
  );
}
