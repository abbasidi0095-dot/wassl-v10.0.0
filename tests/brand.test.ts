import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND_COLORS } from "@/lib/brand";
import { THEME_PRESETS } from "@/lib/theme";

function luminance(hex: string) {
  const channels = [1, 3, 5].map((index) => {
    const value = parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string) {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

describe("Wassl 11 brand identity", () => {
  it("uses the signature palette for Coastal", () => {
    expect(BRAND_COLORS.wasslBlue).toBe("#2447E0");
    expect(BRAND_COLORS.limestone).toBe("#F7F2E8");
    expect(BRAND_COLORS.signalTangerine).toBe("#FF8A3D");
    const coastal = THEME_PRESETS.find((preset) => preset.id === "coastal");
    expect(coastal?.primary).toBe("#2447e0");
    expect(coastal?.accent).toBe("#ff8a3d");
  });

  it("keeps the palette at WCAG AA", () => {
    const pairs: Array<[string, string]> = [
      ["#101a33", "#f7f2e8"],
      ["#5a6478", "#f7f2e8"],
      ["#2447e0", "#fff9ef"],
      ["#8c3a00", "#ffe7d5"],
      ["#e8edf9", "#070c18"],
      ["#95a2bc", "#070c18"],
      ["#a3b2f2", "#070c18"],
    ];
    for (const [foreground, background] of pairs) {
      expect(
        contrast(foreground, background),
        `${foreground} on ${background}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("ships all four themes", () => {
    expect(THEME_PRESETS.map((preset) => preset.id).sort()).toEqual(
      ["aero", "coastal", "midnight", "sand"].sort(),
    );
  });

  it("ships vector masters and app icons", () => {
    const files = [
      "public/brand/wassl-monogram.svg",
      "public/brand/wassl-monogram-reversed.svg",
      "public/brand/wassl-monogram-mono.svg",
      "public/brand/wassl-wordmark-latin.svg",
      "public/brand/wassl-wordmark-arabic.svg",
      "public/brand/wassl-lockup-horizontal.svg",
      "public/brand/wassl-icon.svg",
      "public/icon-32.png",
      "public/icon-48.png",
      "public/icon-192.png",
      "public/icon-512.png",
    ];
    for (const file of files) {
      expect(fs.existsSync(path.join(process.cwd(), file)), file).toBe(true);
    }
  });
});
