import type { OpeningHours, Store } from "./types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseRange(days: string): string[] {
  const parts = days.split(/[–-]/).map((part) => part.trim());
  if (parts.length === 1) return [parts[0]];
  const start = DAYS.indexOf(parts[0]);
  const end = DAYS.indexOf(parts[1]);
  if (start === -1 || end === -1) return parts;
  const result: string[] = [];
  let index = start;
  for (let guard = 0; guard < 7; guard += 1) {
    result.push(DAYS[index]);
    if (index === end) break;
    index = (index + 1) % 7;
  }
  return result;
}

function minutes(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + (minute || 0);
}

/** Morocco uses Africa/Casablanca (UTC+1, with Ramadan adjustments). */
export function casablancaNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Casablanca",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return { day: get("weekday"), minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

export type OpenState = {
  open: boolean;
  label: string;
  detail: string;
};

export function getOpenState(
  store: Pick<Store, "isOpen" | "openingHours" | "prepTime">,
  now = new Date(),
): OpenState {
  if (!store.isOpen) {
    return { open: false, label: "Closed", detail: "Not accepting orders" };
  }
  const hours = store.openingHours ?? [];
  if (!hours.length) {
    return { open: true, label: "Open now", detail: `Ready in ${store.prepTime}–${store.prepTime + 10} min` };
  }
  const { day, minutes: current } = casablancaNow(now);
  const today = hours.filter((entry) => parseRange(entry.days).includes(day));

  for (const entry of today) {
    const open = minutes(entry.open);
    const close = minutes(entry.close);
    if (close <= open) {
      if (current >= open || current < close) {
        return { open: true, label: "Open now", detail: `Closes ${entry.close}` };
      }
    } else if (current >= open && current < close) {
      return { open: true, label: "Open now", detail: `Closes ${entry.close}` };
    }
  }

  const upcoming = today
    .map((entry) => minutes(entry.open))
    .filter((value) => value > current)
    .sort((a, b) => a - b)[0];

  if (upcoming !== undefined) {
    const hour = String(Math.floor(upcoming / 60)).padStart(2, "0");
    const minute = String(upcoming % 60).padStart(2, "0");
    return { open: false, label: "Closed", detail: `Opens ${hour}:${minute}` };
  }
  return { open: false, label: "Closed", detail: "Opens tomorrow" };
}

export function formatHours(hours: OpeningHours[]): string {
  if (!hours.length) return "Hours not published";
  return hours.map((entry) => `${entry.days} ${entry.open}–${entry.close}`).join(" · ");
}
