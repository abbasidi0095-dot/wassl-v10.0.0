import webpush from "web-push";
import { getPushSubscriptions, removePushSubscription } from "./db";
import { isLocale, translate, type Locale } from "./i18n";
import type { Order, OrderStatus, TaxiRide, TaxiStatus } from "./types";

const publicKey = process.env.VAPID_PUBLIC_KEY || "";
const privateKey = process.env.VAPID_PRIVATE_KEY || "";
const subject = process.env.VAPID_SUBJECT || "mailto:admin@wassl.ma";
const configured = Boolean(publicKey && privateKey);

if (configured) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export function getVapidPublicKey(): string | null {
  return configured ? publicKey : null;
}

type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
  kind: "order" | "taxi";
};

const ORDER_STATUS_TEXT: Record<OrderStatus, string> = {
  placed: "Order placed",
  accepted: "Order accepted",
  preparing: "Being prepared",
  ready: "Ready for pickup",
  assigned: "Driver assigned",
  picked_up: "Order picked up",
  en_route: "On the way",
  delivered: "Delivered",
  cancelled: "Order cancelled",
};

const TAXI_STATUS_TEXT: Record<TaxiStatus, string> = {
  requested: "Ride requested",
  accepted: "Driver on the way",
  arriving: "Driver arriving",
  in_progress: "Trip in progress",
  completed: "Trip completed",
  cancelled: "Ride cancelled",
};

function localize(locale: string | undefined, text: string): string {
  const safe: Locale = isLocale(locale) ? locale : "en";
  return translate(safe, text);
}

async function deliver(
  filter: { email?: string; userId?: string },
  payload: PushPayload,
): Promise<number> {
  if (!configured) return 0;
  const subscriptions = await getPushSubscriptions(filter);
  let sent = 0;
  await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify(payload),
        );
        sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await removePushSubscription(subscription.endpoint);
        }
      }
    }),
  );
  return sent;
}

export async function sendPushTest(filter: {
  email?: string;
  userId?: string;
  locale?: string;
}): Promise<number> {
  return deliver(filter, {
    title: localize(filter.locale, "Notifications are on"),
    body: localize(filter.locale, "You will get live updates for orders and taxi rides."),
    url: "/",
    tag: "wassl-test",
    kind: "order",
  });
}

export async function notifyOrderPush(order: Order): Promise<void> {
  if (!order.customerEmail) return;
  const subscriptions = await getPushSubscriptions({ email: order.customerEmail });
  const locale = subscriptions.find((item) => item.locale)?.locale;
  const label = localize(locale, ORDER_STATUS_TEXT[order.status]);
  await deliver(
    { email: order.customerEmail },
    {
      title: `${localize(locale, "Order")} ${order.code}`,
      body: label,
      url: `/orders/${order.id}`,
      tag: `order-${order.id}`,
      kind: "order",
    },
  );
}

export async function notifyTaxiPush(ride: TaxiRide): Promise<void> {
  const subscriptions = await getPushSubscriptions({ userId: ride.customerId });
  const locale = subscriptions.find((item) => item.locale)?.locale;
  const label = localize(locale, TAXI_STATUS_TEXT[ride.status]);
  await deliver(
    { userId: ride.customerId },
    {
      title: localize(locale, "Wassl Taxi"),
      body: `${label} · ${ride.pickupLabel} → ${ride.dropoffLabel}`,
      url: `/taxi/${ride.id}`,
      tag: `taxi-${ride.id}`,
      kind: "taxi",
    },
  );
}
