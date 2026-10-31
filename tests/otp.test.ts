import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  canSendOtp,
  generateOtp,
  recordOtpSend,
  saveOtp,
  verifyOtp,
} from "@/lib/otp";

let dataDir: string;
let counter = 0;

function uniqueEmail() {
  counter += 1;
  return `otp-test-${Date.now()}-${counter}@example.com`;
}

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "wassl-otp-"));
  process.env.WASSL_DATA_DIR = dataDir;
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe("OTP generation and verification", () => {
  it("generates a zero-padded six-digit code", () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generateOtp()).toMatch(/^\d{6}$/);
    }
  });

  it("accepts the correct code once and consumes it", () => {
    const email = uniqueEmail();
    saveOtp(email, "123456", { name: "Amina", role: "merchant" });

    const first = verifyOtp(email, "123456");
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.meta).toEqual({ name: "Amina", role: "merchant" });
    }

    // A code can never be used twice.
    expect(verifyOtp(email, "123456").ok).toBe(false);
  });

  it("is case-insensitive and trims the email", () => {
    const email = uniqueEmail();
    saveOtp(`  ${email.toUpperCase()}  `, "654321");
    expect(verifyOtp(email, " 654321 ").ok).toBe(true);
  });

  it("rejects a wrong code without consuming the entry", () => {
    const email = uniqueEmail();
    saveOtp(email, "111111");

    expect(verifyOtp(email, "222222").ok).toBe(false);
    expect(verifyOtp(email, "111111").ok).toBe(true);
  });

  it("rejects codes that were never requested", () => {
    const result = verifyOtp(uniqueEmail(), "000000");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/No code/i);
    }
  });

  it("locks an entry after five wrong attempts", () => {
    const email = uniqueEmail();
    saveOtp(email, "333333");

    for (let i = 0; i < 5; i += 1) {
      expect(verifyOtp(email, "999999").ok).toBe(false);
    }

    // The correct code no longer works once attempts are exhausted.
    expect(verifyOtp(email, "333333").ok).toBe(false);
  });

  it("rate-limits to three sends per ten minutes", () => {
    const email = uniqueEmail();
    expect(canSendOtp(email).ok).toBe(true);
    recordOtpSend(email);
    recordOtpSend(email);
    recordOtpSend(email);

    const blocked = canSendOtp(email);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);

    // Other addresses are unaffected.
    expect(canSendOtp(uniqueEmail()).ok).toBe(true);
  });
});

describe("OTP accounts", () => {
  it("creates a new merchant account on first sign-in", async () => {
    const db = await import("@/lib/db");
    await db.resetDatabase();

    const user = await db.upsertOtpUser({
      email: "New.Owner@Example.com",
      name: "New Owner",
      role: "merchant",
    });

    expect(user.email).toBe("new.owner@example.com");
    expect(user.name).toBe("New Owner");
    expect(user.role).toBe("merchant");
    expect(user.passwordHash).toBe("");
  });

  it("keeps the existing role and store binding for known staff", async () => {
    const db = await import("@/lib/db");
    await db.resetDatabase();

    const user = await db.upsertOtpUser({
      email: "admin@wassl.ma",
      role: "merchant",
    });

    expect(user.id).toBe("user_admin");
    expect(user.role).toBe("admin");
    expect(user.storeId).toBeUndefined();
  });

  it("looks users up case-insensitively", async () => {
    const db = await import("@/lib/db");
    await db.resetDatabase();

    const user = await db.getUserByEmail("STORE@WASSL.MA");
    expect(user?.id).toBe("user_merchant_dakhla");
    expect(user?.storeId).toBe("store_dakhla_grill");
  });
});

describe("account approval", () => {
  it("never exposes password hashes to the admin console", async () => {
    const db = await import("@/lib/db");
    await db.resetDatabase();

    const users = await db.getUsers();
    expect(users.length).toBeGreaterThan(0);
    expect(users.every((user) => !("passwordHash" in user))).toBe(true);
  });

  it("attaches a store and makes the account a merchant", async () => {
    const db = await import("@/lib/db");
    await db.resetDatabase();

    const created = await db.upsertOtpUser({
      email: "pending-owner@example.com",
      name: "Pending Owner",
    });
    expect(created.storeId).toBeUndefined();

    const updated = await db.updateUserAccess({
      userId: created.id,
      storeId: "store_dakhla_grill",
      actor: { id: "user_admin", name: "Ops", role: "admin" },
    });

    expect(updated.role).toBe("merchant");
    expect(updated.storeId).toBe("store_dakhla_grill");
  });

  it("attaches a driver profile and makes the account a driver", async () => {
    const db = await import("@/lib/db");
    await db.resetDatabase();

    const created = await db.upsertOtpUser({
      email: "pending-driver@example.com",
      role: "driver",
    });

    const updated = await db.updateUserAccess({
      userId: created.id,
      driverId: "driver_youssef",
    });

    expect(updated.role).toBe("driver");
    expect(updated.driverId).toBe("driver_youssef");
    expect(updated.storeId).toBeUndefined();
  });

  it("rejects a store that does not exist", async () => {
    const db = await import("@/lib/db");
    await db.resetDatabase();

    const created = await db.upsertOtpUser({ email: "invalid@example.com" });
    await expect(
      db.updateUserAccess({ userId: created.id, storeId: "store_missing" }),
    ).rejects.toThrow(/Store not found/);
  });
});
