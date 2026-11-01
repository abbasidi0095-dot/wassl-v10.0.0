"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "./locale-provider";
import type { OrderStatus, Role, TaxiRide, TaxiStatus } from "@/lib/types";
import { STATUS_META } from "@/lib/types";
import { TAXI_STATUS_TEXT } from "@/lib/taxi-status";

export type LiveOrder = {
  id: string;
  code: string;
  status: OrderStatus;
  storeName: string;
  total: number;
  itemCount: number;
  createdAt: string;
};

export type WasslNotification = {
  id: string;
  title: string;
  body: string;
  url: string;
  at: string;
  kind: "order" | "taxi" | "system";
  read: boolean;
};

type PushState = "unsupported" | "default" | "granted" | "denied" | "subscribed";

type LiveActivityValue = {
  orders: LiveOrder[];
  rides: TaxiRide[];
  activeOrders: LiveOrder[];
  activeRides: TaxiRide[];
  notifications: WasslNotification[];
  unread: number;
  pushState: PushState;
  pushError: string | null;
  markAllRead: () => void;
  clearNotifications: () => void;
  enablePush: () => Promise<void>;
  sendTest: (delaySeconds?: number) => Promise<number>;
};

const LiveActivityContext = createContext<LiveActivityValue | null>(null);

const NOTIFICATIONS_KEY = "wassl.notifications.v1";

function readNotifications(): WasslNotification[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.slice(0, 30) : [];
  } catch {
    return [];
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function LiveActivityProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [role, setRole] = useState<Role | null>(null);
  const [orders, setOrders] = useState<LiveOrder[]>([]);
  const [rides, setRides] = useState<TaxiRide[]>([]);
  const [notifications, setNotifications] = useState<WasslNotification[]>([]);
  const [pushState, setPushState] = useState<PushState>("default");
  const [pushError, setPushError] = useState<string | null>(null);
  const snapshot = useRef<Record<string, string>>({});
  const seeded = useRef(false);

  const pushNotification = useCallback(
    (item: Omit<WasslNotification, "id" | "at" | "read">) => {
      const entry: WasslNotification = {
        ...item,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        at: new Date().toISOString(),
        read: false,
      };
      setNotifications((current) => {
        const next = [entry, ...current].slice(0, 30);
        try {
          localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });

      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        const options: NotificationOptions = {
          body: item.body,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: `${item.kind}-${item.url}`,
          data: { url: item.url },
        };
        void navigator.serviceWorker
          ?.getRegistration()
          .then((registration) =>
            registration ? registration.showNotification(item.title, options) : undefined,
          )
          .catch(() => undefined);
      }
    },
    [],
  );

  const poll = useCallback(
    async (currentRole: Role) => {
      if (currentRole !== "customer") return;
      const [ordersResponse, ridesResponse] = await Promise.all([
        fetch("/api/orders", { cache: "no-store" }).catch(() => null),
        fetch("/api/taxi/rides", { cache: "no-store" }).catch(() => null),
      ]);

      const nextOrders: LiveOrder[] = ordersResponse?.ok
        ? (((await ordersResponse.json()) as { orders?: LiveOrder[] }).orders ?? [])
        : [];
      const nextRides: TaxiRide[] = ridesResponse?.ok
        ? (((await ridesResponse.json()) as { rides?: TaxiRide[] }).rides ?? [])
        : [];

      setOrders(nextOrders);
      setRides(nextRides);

      const nextSnapshot: Record<string, string> = {};
      for (const order of nextOrders) nextSnapshot[`order:${order.id}`] = order.status;
      for (const ride of nextRides) nextSnapshot[`taxi:${ride.id}`] = ride.status;

      if (seeded.current) {
        for (const order of nextOrders) {
          const previous = snapshot.current[`order:${order.id}`];
          if (previous && previous !== order.status) {
            const label = t(STATUS_META[order.status].label);
            pushNotification({
              title: `${t("Order")} ${order.code}`,
              body: `${order.storeName} · ${label}`,
              url: `/orders/${order.id}`,
              kind: "order",
            });
            if (order.status === "delivered") {
              void import("canvas-confetti").then(({ default: confetti }) =>
                confetti({
                  particleCount: 130,
                  spread: 75,
                  origin: { y: 0.82 },
                  colors: ["#2447e0", "#ff8a3d", "#ff5d73", "#f7f2e8"],
                }),
              );
            }
          }
        }
        for (const ride of nextRides) {
          const previous = snapshot.current[`taxi:${ride.id}`];
          if (previous && previous !== ride.status) {
            const label = t(TAXI_STATUS_TEXT[ride.status]);
            pushNotification({
              title: t("Wassl Taxi"),
              body: `${label} · ${ride.pickupLabel} → ${ride.dropoffLabel}`,
              url: `/taxi/${ride.id}`,
              kind: "taxi",
            });
            if (ride.status === "completed") {
              void import("canvas-confetti").then(({ default: confetti }) =>
                confetti({
                  particleCount: 130,
                  spread: 75,
                  origin: { y: 0.82 },
                  colors: ["#2447e0", "#ff8a3d", "#ff5d73", "#f7f2e8"],
                }),
              );
            }
          }
        }
      }

      snapshot.current = nextSnapshot;
      seeded.current = true;
    },
    [pushNotification, t],
  );

  // Session + polling.
  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        const response = await fetch("/api/session", { cache: "no-store" });
        const data = (await response.json()) as { session?: { role?: Role } | null };
        if (cancelled) return;
        const nextRole = data.session?.role ?? null;
        setRole(nextRole);
        if (nextRole) await poll(nextRole);
      } catch {
        if (!cancelled) setRole(null);
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [pathname, poll]);

  useEffect(() => {
    if (!role) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void poll(role);
    }, 6500);
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll(role);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [role, poll]);

  useEffect(() => {
    setNotifications(readNotifications());
    if (!("Notification" in window)) {
      setPushState("unsupported");
      return;
    }
    const permission = Notification.permission;
    setPushState(permission === "granted" ? "granted" : permission === "denied" ? "denied" : "default");
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (role === "customer") return;
    setOrders([]);
    setRides([]);
  }, [role]);

  const subscribePush = useCallback(async (): Promise<boolean> => {
    const iosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const ios = iosDevice ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (ios && !standalone) {
      setPushError(
        t(
          "Open Wassl from the Home Screen icon. Safari tabs cannot receive iPhone notifications.",
        ),
      );
      return false;
    }
    if (iosDevice) {
      const version = navigator.userAgent.match(/OS (\d+)_(\d+)/);
      if (
        version &&
        (Number(version[1]) < 16 ||
          (Number(version[1]) === 16 && Number(version[2]) < 4))
      ) {
        setPushError(t("iOS 16.4 or later is required for Home Screen notifications."));
        return false;
      }
    }
    if (!("Notification" in window)) {
      setPushError(t("Notifications are not supported in this browser."));
      return false;
    }
    if (Notification.permission !== "granted") {
      setPushError(
        t("Allow notifications in iPhone Settings → Notifications → Wassl."),
      );
      return false;
    }
    if (!("serviceWorker" in navigator)) {
      setPushError(t("Notifications are not supported in this browser."));
      return false;
    }
    await navigator.serviceWorker.register("/sw.js");
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 8000)),
    ]);
    if (!registration) {
      setPushError(
        t(
          "The service worker did not start. Close and reopen the Home Screen app.",
        ),
      );
      return false;
    }
    if (!registration.pushManager) {
      setPushError(t("Notifications are not supported in this browser."));
      return false;
    }
    const keyResponse = await fetch("/api/push/public-key", { cache: "no-store" });
    const keyData = (await keyResponse.json()) as { publicKey?: string | null };
    if (!keyData.publicKey) {
      setPushError(t("The server push key is missing."));
      console.error("[push] VAPID public key is not configured on the server");
      return false;
    }
    const existing = await registration.pushManager.getSubscription();
    let subscription = existing;
    if (!subscription) {
      try {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            keyData.publicKey,
          ) as unknown as BufferSource,
        });
      } catch (error) {
        setPushError(
          t(
            "iOS could not create the push subscription. Check Notification settings and try again.",
          ),
        );
        console.error("[push] subscribe failed", error);
        return false;
      }
    }
    const saved = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...subscription.toJSON(),
        locale: document.documentElement.lang,
      }),
    });
    if (!saved.ok) {
      setPushError(
        saved.status === 401
          ? t("Sign in to enable notifications.")
          : t("Could not save the push subscription. Try again."),
      );
      console.error("[push] subscription could not be saved", saved.status);
      return false;
    }
    setPushError(null);
    setPushState("subscribed");
    return true;
  }, [t]);

  const resetPushSubscription = useCallback(async (): Promise<boolean> => {
    if (!("serviceWorker" in navigator)) return false;
    const registration = await Promise.race([
      navigator.serviceWorker.ready.catch(() => null),
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 8000)),
    ]);
    if (!registration?.pushManager) return false;
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: existing.endpoint }),
      }).catch(() => undefined);
      await existing.unsubscribe().catch(() => undefined);
    }
    return subscribePush();
  }, [subscribePush]);

  const enablePush = useCallback(async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPushState("unsupported");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setPushState(permission === "denied" ? "denied" : "default");
      setPushError(
        t("Allow notifications in iPhone Settings → Notifications → Wassl."),
      );
      return;
    }
    // Always replace an old subscription when the user explicitly enables
    // alerts. This clears subscriptions made with a previous VAPID key.
    await resetPushSubscription().catch((error) => {
      setPushError(
        t(
          "iOS could not create the push subscription. Check Notification settings and try again.",
        ),
      );
      console.error("[push] subscribe failed", error);
      return false;
    });
  }, [resetPushSubscription, t]);

  // If permission was already granted, silently attach this device.
  useEffect(() => {
    if (pushState !== "granted") return;
    void subscribePush().catch(() => undefined);
  }, [pushState, subscribePush]);

  const sendTest = useCallback(
    async (delaySeconds = 0) => {
      // A user can grant notification permission after the first page load.
      // Make sure this device has a saved subscription before asking the server
      // to deliver the test.
      const canNotify =
        typeof Notification !== "undefined" &&
        Notification.permission === "granted";
      if (canNotify) {
        await subscribePush().catch((error) => {
          setPushError(
            t(
              "iOS could not create the push subscription. Check Notification settings and try again.",
            ),
          );
          console.error("[push] test subscription failed", error);
          return false;
        });
      }

      async function requestTest() {
        const response = await fetch("/api/push/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ delaySeconds }),
        });
        if (response.status === 401) {
          setPushError(t("Sign in to enable notifications."));
        }
        const data = (await response.json().catch(() => ({}))) as {
          sent?: number;
        };
        return data.sent ?? 0;
      }

      let sent = await requestTest();

      // A subscription created with an older VAPID key is silently unusable.
      // Replace it once and retry the immediate test.
      if (
        sent === 0 &&
        delaySeconds === 0 &&
        canNotify
      ) {
        const reset = await resetPushSubscription().catch((error) => {
          console.error("[push] reset failed", error);
          return false;
        });
        if (reset) sent = await requestTest();
      }
      return sent;
    },
    [resetPushSubscription, subscribePush],
  );

  const markAllRead = useCallback(() => {
    setNotifications((current) => {
      const next = current.map((item) => ({ ...item, read: true }));
      try {
        localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    try {
      localStorage.removeItem(NOTIFICATIONS_KEY);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<LiveActivityValue>(() => {
    const activeOrders = orders.filter(
      (order) => !["delivered", "cancelled"].includes(order.status),
    );
    const activeRides = rides.filter(
      (ride) => !["completed", "cancelled"].includes(ride.status),
    );
    return {
      orders,
      rides,
      activeOrders,
      activeRides,
      notifications,
      unread: notifications.filter((item) => !item.read).length,
      pushState,
      pushError,
      markAllRead,
      clearNotifications,
      enablePush,
      sendTest,
    };
  }, [
    orders,
    rides,
    notifications,
    pushState,
    pushError,
    markAllRead,
    clearNotifications,
    enablePush,
    sendTest,
  ]);

  return (
    <LiveActivityContext.Provider value={value}>{children}</LiveActivityContext.Provider>
  );
}

export function useLiveActivity(): LiveActivityValue {
  const context = useContext(LiveActivityContext);
  if (!context) throw new Error("useLiveActivity must be used inside LiveActivityProvider");
  return context;
}
