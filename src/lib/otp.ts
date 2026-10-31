import { randomInt } from "node:crypto";

/**
 * Email OTP (one-time passcode) store.
 *
 * Codes live in process memory with a short TTL. This is deliberately simple:
 * a single Node server holds the codes, and a restart invalidates pending
 * codes (the user just requests a new one). For multi-instance deployments,
 * move this to Postgres or Redis.
 */

type OtpEntry = {
  code: string;
  expiresAt: number;
  attempts: number;
  name?: string;
  role?: "admin" | "merchant" | "driver";
};

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_WINDOW = 3;
const SEND_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

type OtpGlobals = {
  __wasslOtpStore?: Map<string, OtpEntry>;
  __wasslOtpSends?: Map<string, number[]>;
};

const globalForOtp = globalThis as unknown as OtpGlobals;

const store =
  globalForOtp.__wasslOtpStore ??
  (() => {
    const map = new Map<string, OtpEntry>();
    globalForOtp.__wasslOtpStore = map;
    return map;
  })();

const sendLog =
  globalForOtp.__wasslOtpSends ??
  (() => {
    const map = new Map<string, number[]>();
    globalForOtp.__wasslOtpSends = map;
    return map;
  })();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function generateOtp(): string {
  // 6-digit numeric code, cryptographically random.
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function canSendOtp(email: string): { ok: boolean; retryAfterSeconds?: number } {
  const key = normalizeEmail(email);
  const now = Date.now();
  const timestamps = (sendLog.get(key) || []).filter(
    (ts) => now - ts < SEND_WINDOW_MS,
  );
  if (timestamps.length >= MAX_SENDS_PER_WINDOW) {
    const oldest = timestamps[0];
    const retryAfterSeconds = Math.ceil((oldest + SEND_WINDOW_MS - now) / 1000);
    return { ok: false, retryAfterSeconds };
  }
  return { ok: true };
}

export function recordOtpSend(email: string): void {
  const key = normalizeEmail(email);
  const now = Date.now();
  const timestamps = (sendLog.get(key) || []).filter(
    (ts) => now - ts < SEND_WINDOW_MS,
  );
  timestamps.push(now);
  sendLog.set(key, timestamps);
}

export function saveOtp(
  email: string,
  code: string,
  meta?: { name?: string; role?: "admin" | "merchant" | "driver" },
): void {
  const key = normalizeEmail(email);
  store.set(key, {
    code,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
    name: meta?.name,
    role: meta?.role,
  });
}

export type OtpVerifyResult =
  | { ok: true; meta?: { name?: string; role?: "admin" | "merchant" | "driver" } }
  | { ok: false; error: string };

export function verifyOtp(email: string, code: string): OtpVerifyResult {
  const key = normalizeEmail(email);
  const entry = store.get(key);

  if (!entry) {
    return { ok: false, error: "No code was requested for this email" };
  }
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return { ok: false, error: "This code has expired. Request a new one." };
  }
  if (entry.attempts >= MAX_ATTEMPTS) {
    store.delete(key);
    return { ok: false, error: "Too many attempts. Request a new code." };
  }

  entry.attempts += 1;

  if (entry.code !== code.trim()) {
    return { ok: false, error: "Incorrect code. Please try again." };
  }

  // Success: consume the code so it cannot be reused.
  store.delete(key);
  return { ok: true, meta: { name: entry.name, role: entry.role } };
}

export function hasPendingOtp(email: string): boolean {
  const key = normalizeEmail(email);
  const entry = store.get(key);
  return Boolean(entry && Date.now() <= entry.expiresAt);
}
