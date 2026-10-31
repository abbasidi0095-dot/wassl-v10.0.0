"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WifiOff } from "lucide-react";

/**
 * Native-only glue for the Capacitor iOS/Android shell. On the web this
 * component renders nothing, so it is safe to mount in the root layout.
 */
export function NativeShell() {
  const router = useRouter();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const removers: Array<() => void> = [];

    (async () => {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform()) return;

      document.documentElement.classList.add("native-app");

      const [appPlugin, networkPlugin, splashPlugin, statusPlugin, pushPlugin] =
        await Promise.all([
          import("@capacitor/app"),
          import("@capacitor/network"),
          import("@capacitor/splash-screen"),
          import("@capacitor/status-bar"),
          import("@capacitor/push-notifications"),
        ]);
      if (cancelled) return;

      const { App } = appPlugin;
      const { Network } = networkPlugin;
      const { SplashScreen } = splashPlugin;
      const { StatusBar, Style } = statusPlugin;
      const { PushNotifications } = pushPlugin;

      const dark = document.documentElement.classList.contains("dark");
      void SplashScreen.hide().catch(() => {});
      void StatusBar.setStyle({ style: dark ? Style.Light : Style.Dark }).catch(() => {});
      void StatusBar.setBackgroundColor({ color: dark ? "#0b1211" : "#f7f3eb" }).catch(
        () => {},
      );

      const back = await App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) window.history.back();
        else void App.minimizeApp();
      });
      removers.push(() => void back.remove());

      const openInternal = (raw?: string | null) => {
        const target = internalPath(raw);
        if (target) router.push(target);
      };

      const launch = await App.getLaunchUrl();
      openInternal(launch?.url);
      const urlOpen = await App.addListener("appUrlOpen", (event) => openInternal(event.url));
      removers.push(() => void urlOpen.remove());

      const status = await Network.getStatus();
      if (!cancelled) setOffline(!status.connected);
      const network = await Network.addListener("networkStatusChange", (next) =>
        setOffline(!next.connected),
      );
      removers.push(() => void network.remove());

      // Order updates: register the device for push once the user is signed in.
      try {
        const response = await fetch("/api/session", { cache: "no-store" });
        const data = (await response.json()) as { session?: unknown };
        if (!data.session) return;
        if (localStorage.getItem("wassl.push.asked") === "1") return;

        let permission = await PushNotifications.checkPermissions();
        if (permission.receive !== "granted") {
          localStorage.setItem("wassl.push.asked", "1");
          permission = await PushNotifications.requestPermissions();
        }
        if (permission.receive !== "granted") return;

        await PushNotifications.register();
        const registration = await PushNotifications.addListener("registration", (token) => {
          void fetch("/api/devices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: token.value, platform: Capacitor.getPlatform() }),
          });
        });
        removers.push(() => void registration.remove());
      } catch {
        // Push is optional; the app keeps working with live in-page updates.
      }
    })().catch(() => {});

    return () => {
      cancelled = true;
      for (const remove of removers) remove();
    };
  }, [router]);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-2 bg-ink px-3 py-2 text-[11px] font-semibold text-on-dark"
    >
      <WifiOff size={13} className="text-saffron" />
      No connection — waiting for the network
    </div>
  );
}

/** Map https and wassl:// links onto in-app routes. */
function internalPath(raw?: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol === "wassl:") {
      const path = `/${url.host}${url.pathname}`.replace(/\/{2,}/g, "/");
      return `${path}${url.search}${url.hash}`;
    }
    if (url.host === window.location.host) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
    return null;
  } catch {
    return null;
  }
}
