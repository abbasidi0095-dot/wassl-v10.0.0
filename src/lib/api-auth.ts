import { getSessionFromRequest } from "./auth";
import type { OrderActor } from "./order-machine";
import type { Role, Session } from "./types";

export function requireApiRole(request: Request, roles: Role[]): Session | Response {
  const session = getSessionFromRequest(request);
  if (!session) {
    return Response.json({ error: "Please sign in" }, { status: 401 });
  }
  if (session.status === "pending") {
    return Response.json(
      { error: "Your account is waiting for operator approval", code: "account_pending" },
      { status: 403 },
    );
  }
  if (session.status === "rejected") {
    return Response.json(
      { error: "This account was not approved", code: "account_rejected" },
      { status: 403 },
    );
  }
  if (!roles.includes(session.role)) {
    return Response.json({ error: "You do not have access to this action" }, { status: 403 });
  }
  return session;
}

export function actorFromSession(session: Session): OrderActor {
  return {
    role: session.role,
    id: session.userId,
    name: session.name,
    storeId: session.storeId,
    driverId: session.driverId,
  };
}

export function isResponse(value: Session | Response): value is Response {
  return value instanceof Response;
}
