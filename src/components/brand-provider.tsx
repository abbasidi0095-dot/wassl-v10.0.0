"use client";

import { createContext, useContext } from "react";
import { BRAND } from "@/lib/brand";

export type BrandValue = {
  brandName: string;
  brandNameAr: string;
  logoImage?: string;
  primaryColor: string;
  accentColor: string;
  supportPhone: string;
  themePreset?: string;
};

const defaultBrand: BrandValue = {
  brandName: BRAND.name,
  brandNameAr: BRAND.nameAr,
  primaryColor: "#0b4a45",
  accentColor: "#955b0b",
  supportPhone: BRAND.supportPhone,
};

const BrandContext = createContext<BrandValue>(defaultBrand);

export function BrandProvider({
  value,
  children,
}: {
  value: BrandValue;
  children: React.ReactNode;
}) {
  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand() {
  return useContext(BrandContext);
}
