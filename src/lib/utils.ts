export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function money(value: number, currency = "MAD") {
  return `${new Intl.NumberFormat("fr-MA", {
    maximumFractionDigits: 0,
  }).format(value)} ${currency}`;
}

export function timeAgo(iso: string) {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} d ago`;
}

export function clock(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function eta(iso: string, minutes: number) {
  return new Date(new Date(iso).getTime() + minutes * 60 * 1000);
}

export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const DIETARY_TAGS = ["Vegetarian", "Vegan", "Seafood"] as const;

export function categoryLabel(category: string) {
  const labels: Record<string, string> = {
    restaurant: "Restaurants",
    grocery: "Groceries",
    pharmacy: "Pharmacy",
    cafe: "Cafés",
    gifts: "Gifts",
  };
  return labels[category] || category;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
