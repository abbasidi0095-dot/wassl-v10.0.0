import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND_COLORS } from "@/lib/brand";
import { THEME_PRESETS } from "@/lib/theme";

describe("Wassl 11 brand identity", () => {
  it("uses the signature palette for Coastal", () => {
    expect(BRAND_COLORS.atlanticInk).toBe("#153F37");
    expect(BRAND_COLORS.limestone).toBe("#F4F0E6");
    expect(BRAND_COLORS.signalSaffron).toBe("#E6A23A");
    const coastal = THEME_PRESETS.find((preset) => preset.id === "coastal");
    expect(coastal?.primary).toBe("#153f37");
    expect(coastal?.accent).toBe("#e6a23a");
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
