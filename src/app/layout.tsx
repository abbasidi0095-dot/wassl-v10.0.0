import type { Metadata, Viewport } from "next";
import { CartProvider } from "@/components/cart-provider";
import { LocaleProvider } from "@/components/locale-provider";
import { LiveActivityProvider } from "@/components/live-activity-provider";
import { OngoingTracker } from "@/components/ongoing-tracker";
import { NativeShell } from "@/components/native-shell";
import { BrandProvider } from "@/components/brand-provider";
import { dirFor } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { getSettings } from "@/lib/db";
import { themeStyle } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  ),
  title: {
    default: "Wassl — local delivery for Southern Morocco",
    template: "%s · Wassl",
  },
  description:
    "Order from local stores and 24/7 supermarkets in Dakhla, Laayoune, Boujdour, Esmara and Tarfaya. Cash on delivery, live tracking and one app for delivery, grocery and taxi.",
  applicationName: "Wassl",
  keywords: ["Wassl", "delivery", "Dakhla", "Laayoune", "Morocco", "COD"],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Wassl",
    statusBarStyle: "default",
  },
  openGraph: {
    title: "Wassl — local delivery for Southern Morocco",
    description:
      "Local stores, local drivers, cash on delivery and live tracking from Dakhla to Tarfaya.",
    type: "website",
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "Wassl" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: "#0b4a45",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [locale, settings] = await Promise.all([getLocale(), getSettings()]);
  const defaultDark =
    settings.defaultTheme === "dark"
      ? "true"
      : settings.defaultTheme === "light"
        ? "false"
        : 'window.matchMedia("(prefers-color-scheme: dark)").matches';
  return (
    <html
      lang={locale}
      dir={dirFor(locale)}
      style={themeStyle(settings)}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem("wassl.theme");var d=s?s==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(d)document.documentElement.classList.add("dark");}catch(e){}})();`,
          }}
        />
        <link
          rel="preload"
          href="/fonts/instrument-sans-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/bricolage-grotesque-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <BrandProvider
          value={{
            brandName: settings.brandName,
            brandNameAr: settings.brandNameAr,
            logoImage: settings.logoImage,
            primaryColor: settings.primaryColor,
            accentColor: settings.accentColor ?? "#955b0b",
            supportPhone: settings.supportPhone,
            themePreset: settings.themePreset,
          }}
        >
        <LocaleProvider initialLocale={locale}>
          <LiveActivityProvider>
            <CartProvider>
              <NativeShell />
              {children}
              <OngoingTracker />
            </CartProvider>
          </LiveActivityProvider>
        </LocaleProvider>
        </BrandProvider>
      </body>
    </html>
  );
}
