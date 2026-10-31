import type { TaxiStatus } from "./types";

/** English labels used as i18n dictionary keys. */
export const TAXI_STATUS_TEXT: Record<TaxiStatus, string> = {
  requested: "Ride requested",
  accepted: "Driver on the way",
  arriving: "Driver arriving",
  in_progress: "Trip in progress",
  completed: "Trip completed",
  cancelled: "Ride cancelled",
};

export const TAXI_STATUS_ORDER: TaxiStatus[] = [
  "requested",
  "accepted",
  "arriving",
  "in_progress",
  "completed",
];
