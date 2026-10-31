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
  markAllRead: () => void;
  clearNotifications: () => void;
  enablePush: () => Promise<void>;
  sendTest: () => Promise<number>;
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
                  colors: ["#0f6e6e", "#e8a33d", "#e85d3f", "#f7f3eb"],
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
                  colors: ["#0f6e6e", "#e8a33d", "#e85d3f", "#f7f3eb"],
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

  const subscribePush = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    const registration = await navigator.serviceWorker.register("/sw.js");
    const keyResponse = await fetch("/api/push/public-key", { cache: "no-store" });
    const keyData = (await keyResponse.json()) as { publicKey?: string | null };
    if (!keyData.publicKey) return;
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey) as unknown as BufferSource,
      }));
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...subscription.toJSON(),
        locale: document.documentElement.lang,
      }),
    });
    setPushState("subscribed");
  }, []);

  const enablePush = useCallback(async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPushState("unsupported");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setPushState(permission === "denied" ? "denied" : "default");
      return;
    }
    await subscribePush();
  }, [subscribePush]);

  // If permission was already granted, silently attach this device.
  useEffect(() => {
    if (pushState !== "granted") return;
    void subscribePush().catch(() => undefined);
  }, [pushState, subscribePush]);

  const sendTest = useCallback(async () => {
    const response = await fetch("/api/push/test", { method: "POST" });
    const data = (await response.json().catch(() => ({}))) as { sent?: number };
    pushNotification({
      title: t("Notifications are on"),
      body: t("You will get live updates for orders and taxi rides."),
      url: "/",
      kind: "system",
    });
    return data.sent ?? 0;
  }, [pushNotification, t]);

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
