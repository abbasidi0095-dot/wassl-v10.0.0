import type { CSSProperties } from "react";
import type { PlatformSettings } from "./types";

export type ThemePresetId = NonNullable<PlatformSettings["themePreset"]>;

export const THEME_PRESETS: {
  id: Exclude<ThemePresetId, "custom">;
  label: string;
  primary: string;
  accent: string;
  note: string;
}[] = [
  {
    id: "coastal",
    label: "Coastal",
    primary: "#2447e0",
    accent: "#ff8a3d",
    note: "Cobalt, limestone and tangerine",
  },
  {
    id: "aero",
    label: "Aero",
    primary: "#0e7490",
    accent: "#f59e0b",
    note: "Ice blue and citrus light",
  },
  {
    id: "midnight",
    label: "Midnight",
    primary: "#3949c8",
    accent: "#ffb020",
    note: "Indigo night with warm gold",
  },
  {
    id: "sand",
    label: "Sand",
    primary: "#9a4b2e",
    accent: "#e0a03a",
    note: "Clay, dune and desert light",
  },
];

const DEFAULT_PRIMARY = "#2447e0";
const DEFAULT_ACCENT = "#ff8a3d";

function normalizeHex(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return `#${trimmed
      .slice(1)
      .split("")
      .map((character) => character + character)
      .join("")}`.toLowerCase();
  }
  return fallback;
}

function toRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function toHex(rgb: [number, number, number]): string {
  return `#${rgb
    .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0"))
    .join("")}`;
}

function mix(from: string, to: string, amount: number): string {
  const a = toRgb(from);
  const b = toRgb(to);
  return toHex([
    a[0] + (b[0] - a[0]) * amount,
    a[1] + (b[1] - a[1]) * amount,
    a[2] + (b[2] - a[2]) * amount,
  ]);
}

function luminance(hex: string): number {
  const channels = toRgb(hex).map((value) => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/**
 * Inline CSS variables let the admin change the brand without a rebuild.
 * The stylesheet reads the `-custom` values and falls back to the shipped
 * Coastal palette when no override exists.
 */
export function themeStyle(settings: PlatformSettings): CSSProperties {
  const primary = normalizeHex(settings.primaryColor, DEFAULT_PRIMARY);
  const accent = normalizeHex(settings.accentColor, DEFAULT_ACCENT);
  const brandInk = luminance(primary) > 0.52 ? "#070c18" : "#fff9ef";

  return {
    "--brand-custom": primary,
    "--brand-deep-custom": mix(primary, "#000000", 0.2),
    "--brand-soft-custom": mix(primary, "#ffffff", 0.84),
    "--brand-ink-custom": brandInk,
    "--brand-custom-dark": mix(primary, "#ffffff", 0.58),
    "--brand-deep-custom-dark": mix(primary, "#ffffff", 0.72),
    "--brand-soft-custom-dark": mix(primary, "#0b0f1c", 0.82),
    "--brand-ink-custom-dark": "#07122e",
    "--signal-custom": accent,
    "--signal-ink-custom": mix(accent, "#000000", 0.45),
    "--signal-soft-custom": mix(accent, "#ffffff", 0.82),
    "--signal-custom-dark": mix(accent, "#ffffff", 0.28),
    "--signal-ink-custom-dark": mix(accent, "#ffffff", 0.48),
    "--signal-soft-custom-dark": mix(accent, "#0b0f1c", 0.8),
    "--signal-on-dark": mix(accent, "#ffffff", 0.45),
  } as CSSProperties;
}
