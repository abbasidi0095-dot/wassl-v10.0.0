import type { Metadata, Viewport } from "next";
import { CartProvider } from "@/components/cart-provider";
import { LocaleProvider } from "@/components/locale-provider";
import { LiveActivityProvider } from "@/components/live-activity-provider";
import { OngoingTracker } from "@/components/ongoing-tracker";
import { NativeShell } from "@/components/native-shell";
import { BrandProvider } from "@/components/brand-provider";
import { SplashIntro } from "@/components/splash-intro";
import { PwaUpdater } from "@/components/pwa-updater";
import { FloatingCart } from "@/components/floating-cart";
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
      { url: "/icon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Wassl",
    statusBarStyle: "default",
    startupImage: [
      { url: "/splash/iphone-750x1334.png", media: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)" },
      { url: "/splash/iphone-1125x2436.png", media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)" },
      { url: "/splash/iphone-1170x2532.png", media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)" },
      { url: "/splash/iphone-1284x2778.png", media: "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)" },
      { url: "/splash/iphone-1179x2556.png", media: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)" },
      { url: "/splash/iphone-1206x2622.png", media: "(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3)" },
      { url: "/splash/iphone-1290x2796.png", media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)" },
      { url: "/splash/iphone-1320x2868.png", media: "(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3)" },
      { url: "/splash/iphone-1242x2688.png", media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)" },
      { url: "/splash/ipad-2048x2732.png", media: "(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)" },
    ],
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
  maximumScale: 1,
  userScalable: false,
  themeColor: "#153F37",
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
      data-theme={settings.themePreset ?? "coastal"}
      style={themeStyle(settings)}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem("wassl.theme");var d=s?s==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(d)document.documentElement.classList.add("dark");var reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;if(reduce){document.documentElement.classList.add("wassl-splash-skip");}else{document.documentElement.classList.add("wassl-splashing");}document.addEventListener("gesturestart",function(e){e.preventDefault();},{passive:false});document.addEventListener("gesturechange",function(e){e.preventDefault();},{passive:false});}catch(e){}})();`,
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
          <SplashIntro />
          <LiveActivityProvider>
            <CartProvider>
              <NativeShell />
              {children}
              <OngoingTracker />
              <FloatingCart />
              <PwaUpdater />
            </CartProvider>
          </LiveActivityProvider>
        </LocaleProvider>
        </BrandProvider>
      </body>
    </html>
  );
}
