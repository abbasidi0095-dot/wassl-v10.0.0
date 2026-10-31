import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { homeForRole } from "./auth-config";
import { parseSessionToken } from "./security";
import type { Role, Session } from "./types";

export const SESSION_COOKIE = "wassl_session";

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return parseSessionToken(store.get(SESSION_COOKIE)?.value);
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.status === "pending") redirect("/pending");
  if (session.status === "rejected") redirect("/login?blocked=1");
  return session;
}

export async function requireRole(role: Role): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(`/login?next=${role}`);
  if (session.status === "pending") redirect("/pending");
  if (session.status === "rejected") redirect("/login?blocked=1");
  if (session.role !== role) redirect(homeForRole(session.role));
  return session;
}

/** Cookie attributes shared by every route that starts a session. */
export function sessionCookieOptions(request: Request) {
  const secure =
    new URL(request.url).protocol === "https:" ||
    request.headers.get("x-forwarded-proto") === "https";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: 60 * 60 * 12,
  };
}

export function getSessionFromRequest(request: Request): Session | null {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  if (!match) return null;
  return parseSessionToken(decodeURIComponent(match.slice(SESSION_COOKIE.length + 1)));
}

export function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

export function badRequest(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
