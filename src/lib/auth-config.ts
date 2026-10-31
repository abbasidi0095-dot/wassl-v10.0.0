import type { Role } from "./types";

/**
 * Provisioned credentials for this deployment.
 *
 * The admin password can be rotated without a code change by setting
 * WASSL_ADMIN_PASSWORD on the server. The fallback exists so the private demo
 * deployment always has a working operator login; change it before production.
 */
export const BOOTSTRAP_ADMIN_EMAIL =
  process.env.WASSL_ADMIN_EMAIL || "admin@wassl.ma";
export const BOOTSTRAP_ADMIN_PASSWORD =
  process.env.WASSL_ADMIN_PASSWORD || "admin";

/** Seeded demo staff. New self-service accounts never get these defaults. */
export const DEMO_STORE_EMAIL = "store@wassl.ma";
export const DEMO_STORE_PASSWORD =
  process.env.WASSL_DEMO_STORE_PASSWORD || "Wsl-Store-4Dkh!2026";
export const DEMO_DRIVER_EMAIL = "driver@wassl.ma";
export const DEMO_DRIVER_PASSWORD =
  process.env.WASSL_DEMO_DRIVER_PASSWORD || "Wsl-Driver-9Lay!2026";
export const DEMO_CUSTOMER_EMAIL = "customer@wassl.ma";
export const DEMO_CUSTOMER_PASSWORD =
  process.env.WASSL_DEMO_CUSTOMER_PASSWORD || "Wsl-Customer-2Dkh!2026";

/** Workspace each role lands in after sign-in. */
export function homeForRole(role: Role): string {
  if (role === "admin") return "/admin";
  if (role === "merchant") return "/merchant";
  if (role === "driver") return "/driver";
  return "/account";
}
