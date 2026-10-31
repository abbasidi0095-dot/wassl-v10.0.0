import { getSessionFromRequest } from "./auth";
import { getDriver } from "./db";
import type { EventFilter } from "./events";
import type { Session } from "./types";

type Authorized = { filter: EventFilter; session: Session | null };

function requestedFilter(url: URL): EventFilter {
  return {
    type: url.searchParams.get("type") || undefined,
    excludeType: url.searchParams.get("excludeType") || undefined,
    orderId: url.searchParams.get("orderId") || undefined,
    storeId: url.searchParams.get("storeId") || undefined,
    citySlug: url.searchParams.get("citySlug") || undefined,
    driverId: url.searchParams.get("driverId") || undefined,
  };
}

function forbidden(message: string) {
  return Response.json({ error: message }, { status: 403 });
}

/**
 * Resolve the server-side scope for an event subscription.
 *
 * Staff filters are never trusted from the query string: a merchant is pinned
 * to its own store, a driver to its own city/driver id, and an admin may see
 * the full operations feed. Customers can subscribe only to one order id
 * (which is an unguessable random id) without signing in.
 */
export async function authorizeEventRequest(
  request: Request,
): Promise<Authorized | Response> {
  const url = new URL(request.url);
  const requested = requestedFilter(url);
  const session = getSessionFromRequest(request);

  if (session?.role === "admin") {
    return { filter: requested, session };
  }

  if (session?.role === "merchant") {
    if (!session.storeId) return forbidden("Merchant store is missing");
    if (requested.storeId && requested.storeId !== session.storeId) {
      return forbidden("This store does not belong to your account");
    }
    return { filter: { ...requested, storeId: session.storeId }, session };
  }

  if (session?.role === "driver") {
    if (!session.driverId) return forbidden("Driver profile is missing");
    const driver = await getDriver(session.driverId);
    if (!driver) return forbidden("Driver profile was not found");
    if (requested.citySlug && requested.citySlug !== driver.citySlug) {
      return forbidden("You can only follow orders in your city");
    }
    if (requested.driverId && requested.driverId !== driver.id) {
      return forbidden("You can only follow your own driver updates");
    }
    return {
      // Drivers only need order activity in their city. Excluding driver
      // events prevents every GPS ping from waking every driver's queue.
      filter: {
        ...requested,
        type: "order",
        citySlug: driver.citySlug,
        driverId: undefined,
      },
      session,
    };
  }

  if (requested.orderId) {
    return { filter: { orderId: requested.orderId }, session: null };
  }

  return Response.json({ error: "Please sign in" }, { status: 401 });
}
