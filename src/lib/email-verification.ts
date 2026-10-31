import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { User } from "./types";

/**
 * Email verification for self-service accounts.
 *
 * The plaintext code only ever exists in the email and in the request that
 * checks it. The database stores an HMAC of `email + code`, so a leaked
 * database snapshot cannot be used to verify an address.
 */

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_SENDS = 3;
export const OTP_SEND_WINDOW_MS = 10 * 60 * 1000;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

export function generateVerificationCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function pepper(): string {
  return process.env.WASSL_SECRET || "wassl-local-otp-pepper";
}

export function hashVerificationCode(email: string, code: string): string {
  return createHmac("sha256", pepper())
    .update(`${email.trim().toLowerCase()}\n${code.trim()}`)
    .digest("hex");
}

export function codeMatches(
  email: string,
  code: string,
  storedHash: string,
): boolean {
  const candidate = Buffer.from(hashVerificationCode(email, code), "hex");
  const expected = Buffer.from(storedHash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

/** `abbasidi0095@gmail.com` → `ab***@gmail.com` */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(2, local.length - visible.length))}@${domain}`;
}

/**
 * Accounts created before email verification existed have no flag. They keep
 * working; only accounts explicitly marked `false` must verify.
 */
export function isEmailVerified(user: Pick<User, "emailVerified">): boolean {
  return user.emailVerified !== false;
}

export function verificationExpiry(now = Date.now()): string {
  return new Date(now + OTP_TTL_MS).toISOString();
}

export function isTestMode(): boolean {
  return process.env.WASSL_OTP_TEST_MODE === "1";
}

export type VerificationFailure =
  | "not_found"
  | "already_verified"
  | "cooldown"
  | "rate_limited"
  | "no_code"
  | "expired"
  | "too_many_attempts"
  | "incorrect";

export function failureMessage(failure: VerificationFailure): string {
  switch (failure) {
    case "expired":
      return "This code has expired. Request a new one.";
    case "too_many_attempts":
      return "Too many attempts. Request a new code.";
    case "incorrect":
      return "That code is not correct. Check the email and try again.";
    case "cooldown":
      return "A code was just sent. Wait a minute before requesting another.";
    case "rate_limited":
      return "Too many codes requested. Try again later.";
    case "already_verified":
      return "This email is already verified.";
    case "not_found":
    case "no_code":
      return "Request a verification code first.";
  }
}
