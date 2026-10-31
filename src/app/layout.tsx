import type { Metadata, Viewport } from "next";
import { CartProvider } from "@/components/cart-provider";
import { LocaleProvider } from "@/components/locale-provider";
import { LiveActivityProvider } from "@/components/live-activity-provider";
import { OngoingTracker } from "@/components/ongoing-tracker";
import { NativeShell } from "@/components/native-shell";
import { dirFor } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
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
    "Order from local stores in Dakhla, Laayoune, Boujdour, Esmara and Tarfaya. Cash on delivery, live driver tracking and one simple app.",
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
  themeColor: "#0f6e6e",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale} dir={dirFor(locale)} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem("wassl.theme");var d=s?s==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(d)document.documentElement.classList.add("dark");}catch(e){}})();`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Noto+Kufi+Arabic:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <LocaleProvider initialLocale={locale}>
          <LiveActivityProvider>
            <CartProvider>
              <NativeShell />
              {children}
              <OngoingTracker />
            </CartProvider>
          </LiveActivityProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
