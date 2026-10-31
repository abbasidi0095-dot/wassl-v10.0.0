import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import type { Session } from "./types";

const DEV_SECRET = "wassl-dev-secret-change-before-production";
const LEGACY_SALT = "wassl-demo-salt-v1";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function sessionSecret(): string {
  return process.env.WASSL_SECRET || DEV_SECRET;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, hash: string): boolean {
  try {
    if (hash.startsWith("scrypt$")) {
      const [, salt, expectedHex] = hash.split("$");
      if (!salt || !expectedHex) return false;
      const candidate = scryptSync(password, salt, 64);
      const expected = Buffer.from(expectedHex, "hex");
      if (candidate.length !== expected.length) return false;
      return timingSafeEqual(candidate, expected);
    }

    // Backwards compatibility for the original demo database. New hashes are
    // always written with a per-user random salt.
    const candidate = scryptSync(password, LEGACY_SALT, 64);
    const expected = Buffer.from(hash, "hex");
    if (candidate.length !== expected.length) return false;
    return timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

export function createSessionToken(session: Session): string {
  const payload = Buffer.from(
    JSON.stringify({
      ...session,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    }),
  ).toString("base64url");
  const sig = createHmac("sha256", sessionSecret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export function parseSessionToken(token?: string | null): Session | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", sessionSecret())
    .update(payload)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Session & {
      exp: number;
    };
    if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    return {
      userId: data.userId,
      role: data.role,
      name: data.name,
      email: data.email,
      status: data.status,
      storeId: data.storeId,
      driverId: data.driverId,
    };
  } catch {
    return null;
  }
}

export function randomId(prefix: string, length = 10): string {
  return `${prefix}_${randomBytes(length).toString("hex").slice(0, length * 2)}`;
}

export function orderCode(): string {
  return `WSL-${randomBytes(3).toString("hex").toUpperCase()}`;
}
