import { createHmac, timingSafeEqual } from "node:crypto";
import type { User } from "./types";

/**
 * Moroccan mobile numbers only. Accepts the formats people actually type:
 * 0612345678, 06 12 34 56 78, +212612345678, 00212612345678, 212612345678.
 */
export function normalizeMoroccanPhone(raw: string | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim().replace(/[\s().-]/g, "");
  if (!value) return null;

  if (value.startsWith("+212")) value = value.slice(4);
  else if (value.startsWith("00212")) value = value.slice(5);
  else if (value.startsWith("212")) value = value.slice(3);

  if (value.startsWith("0")) value = value.slice(1);
  if (!/^[67]\d{8}$/.test(value)) return null;
  return `+212${value}`;
}

/** `+212612345678` → `+212 6•• ••• 78` */
export function maskPhone(phone: string): string {
  const normalized = normalizeMoroccanPhone(phone) ?? phone;
  if (!normalized.startsWith("+212") || normalized.length < 8) return normalized;
  const national = normalized.slice(4);
  return `+212 ${national.slice(0, 1)}•• ••• ${national.slice(-2)}`;
}

/** Legacy accounts without the flag keep their access. */
export function isPhoneVerified(user: Pick<User, "phoneVerified">): boolean {
  return user.phoneVerified !== false;
}

const TICKET_TTL_MS = 15 * 60 * 1000;

function ticketPepper(): string {
  return process.env.WASSL_SECRET || "wassl-local-otp-pepper";
}

/**
 * Short-lived proof that this browser just passed the email step or signed in.
 * The phone endpoints require it, so knowing an email is not enough to trigger
 * SMS or try codes.
 */
export function createPhoneTicket(email: string, now = Date.now()): string {
  const expires = now + TICKET_TTL_MS;
  const signature = createHmac("sha256", ticketPepper())
    .update(`phone-ticket\n${email.trim().toLowerCase()}\n${expires}`)
    .digest("hex");
  return `${expires}.${signature}`;
}

export function verifyPhoneTicket(
  email: string,
  ticket: string | undefined,
  now = Date.now(),
): boolean {
  if (!ticket) return false;
  const [rawExpires, signature] = ticket.split(".");
  const expires = Number(rawExpires);
  if (!Number.isFinite(expires) || expires < now) return false;
  if (!signature) return false;
  const expected = createHmac("sha256", ticketPepper())
    .update(`phone-ticket\n${email.trim().toLowerCase()}\n${expires}`)
    .digest("hex");
  const candidate = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (candidate.length !== expectedBuffer.length) return false;
  return timingSafeEqual(candidate, expectedBuffer);
}
