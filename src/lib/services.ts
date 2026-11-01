import type { ServiceBookingStatus, ServiceCategory } from "./types";

export const SERVICE_CATEGORIES: Array<{
  id: ServiceCategory;
  label: string;
  note: string;
}> = [
  { id: "laundry", label: "Laundry", note: "Wash, dry, fold and ironing" },
  { id: "cleaning", label: "Cleaning", note: "Home, office and deep cleaning" },
  { id: "plumbing", label: "Plumbing", note: "Leaks, taps and installations" },
  { id: "electrical", label: "Electrical", note: "Sockets, lighting and repairs" },
  { id: "maintenance", label: "Home maintenance", note: "Small repairs and handyman work" },
  { id: "moving", label: "Moving", note: "Packing and local moves" },
  { id: "other", label: "Other", note: "Admin-approved local services" },
];

export const SERVICE_STATUS_TEXT: Record<ServiceBookingStatus, string> = {
  requested: "Waiting for provider",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const SERVICE_SLOTS = [
  "09:00",
  "11:00",
  "13:00",
  "15:00",
  "17:00",
  "19:00",
];

export function serviceCategory(category: ServiceCategory) {
  return SERVICE_CATEGORIES.find((entry) => entry.id === category) ?? SERVICE_CATEGORIES[6];
}
