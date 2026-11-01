import { haversineKm } from "./grocery";
import type { OrderActor } from "./order-machine";
import type { ParcelDelivery, ParcelSize, ParcelStatus } from "./types";

export const PARCEL_SIZES: Array<{
  id: ParcelSize;
  label: string;
  description: string;
  multiplier: number;
}> = [
  {
    id: "document",
    label: "Document",
    description: "Envelope, papers or a small folder",
    multiplier: 1,
  },
  {
    id: "small",
    label: "Small package",
    description: "Up to 5 kg, fits in a backpack",
    multiplier: 1.1,
  },
  {
    id: "medium",
    label: "Medium package",
    description: "Up to 15 kg, needs a bike box",
    multiplier: 1.35,
  },
  {
    id: "large",
    label: "Large package",
    description: "Up to 25 kg, subject to driver capacity",
    multiplier: 1.7,
  },
];

export const PARCEL_TRANSITIONS: Record<ParcelStatus, ParcelStatus[]> = {
  requested: ["accepted", "cancelled"],
  accepted: ["picked_up", "cancelled"],
  picked_up: ["in_transit", "cancelled"],
  in_transit: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

export const PARCEL_STATUS_TEXT: Record<ParcelStatus, string> = {
  requested: "Looking for a driver",
  accepted: "Driver assigned",
  picked_up: "Collected",
  in_transit: "On the way",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function parcelSize(size: ParcelSize) {
  return PARCEL_SIZES.find((entry) => entry.id === size) ?? PARCEL_SIZES[0];
}

export function estimateParcelFare(
  size: ParcelSize,
  distanceKm: number,
): number {
  const base = 15;
  const perKm = 4;
  const multiplier = parcelSize(size).multiplier;
  return Math.max(20, Math.round((base + distanceKm * perKm) * multiplier));
}

export function parcelDistance(
  pickup: { lat: number; lng: number },
  dropoff: { lat: number; lng: number },
): number {
  return Math.round(haversineKm(pickup, dropoff) * 10) / 10;
}

export function canMoveParcel(
  from: ParcelStatus,
  to: ParcelStatus,
): boolean {
  return PARCEL_TRANSITIONS[from].includes(to);
}

export function parcelActorCan(
  parcel: ParcelDelivery,
  actor: OrderActor,
): boolean {
  if (actor.role === "admin") return true;
  if (actor.role === "customer") return parcel.customerId === actor.id;
  if (actor.role === "driver") {
    return parcel.driverId === actor.driverId || (!parcel.driverId && parcel.status === "requested");
  }
  return false;
}
