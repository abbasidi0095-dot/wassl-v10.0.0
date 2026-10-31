import type { GrocerySettings } from "./types";

/** Shared presets so seeded and migrated databases get the same demo behaviour. */
export const GROCERY_PRESETS: Record<string, GrocerySettings> = {
  "sahara-market": {
    expressEnabled: true,
    expressFee: 12,
    expressMinutes: 30,
    pickupEnabled: true,
    alwaysOpen: true,
    overnightStaffed: true,
    nightStart: "23:00",
    nightEnd: "06:00",
    nightFee: 8,
    schedulingEnabled: true,
    scheduleSlots: ["08:00", "10:00", "12:00", "15:00", "18:00", "21:00"],
    deliveryZones: [
      { id: "centre", name: "Dakhla centre", maxKm: 8, fee: 8, minOrder: 40 },
      { id: "extended", name: "Dakhla extended", maxKm: 18, fee: 14, minOrder: 60 },
    ],
    substitutionDefault: "allow",
    lowStockThreshold: 5,
    loyaltyPointsPer10Mad: 1,
  },
  "boujdour-fresh": {
    expressEnabled: false,
    expressFee: 10,
    expressMinutes: 35,
    pickupEnabled: true,
    alwaysOpen: false,
    overnightStaffed: false,
    nightStart: "22:00",
    nightEnd: "07:00",
    nightFee: 8,
    schedulingEnabled: true,
    scheduleSlots: ["09:00", "12:00", "16:00", "19:00"],
    deliveryZones: [
      { id: "centre", name: "Boujdour centre", maxKm: 10, fee: 8, minOrder: 30 },
    ],
    substitutionDefault: "refund",
    lowStockThreshold: 4,
    loyaltyPointsPer10Mad: 1,
  },
};
