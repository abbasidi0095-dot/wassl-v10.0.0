import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Wassl native shell (iOS + Android).
 *
 * The app is server-rendered (auth cookies, SSE live orders, MapLibre), so the
 * native shell loads the production Next.js app instead of a static export.
 * Override the URL for staging with CAPACITOR_SERVER_URL.
 *
 * Build:  npm run mobile:sync && npx cap open ios|android
 */
const serverUrl = process.env.CAPACITOR_SERVER_URL || "https://wassl.shop";

const config: CapacitorConfig = {
  appId: "ma.wassl.app",
  appName: "Wassl",
  webDir: "mobile/www",
  backgroundColor: "#F7F2E8",
  server: {
    url: serverUrl,
    cleartext: process.env.CAPACITOR_CLEARTEXT === "1",
    androidScheme: "https",
    // Bundled page shown when the device is offline and the app cannot load.
    errorPath: "offline.html",
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#F7F2E8",
  },
  ios: {
    backgroundColor: "#F7F2E8",
    contentInset: "never",
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#0B1226",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#F7F2E8",
      overlaysWebView: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
