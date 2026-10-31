import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  codeMatches,
  generateVerificationCode,
  hashVerificationCode,
  isEmailVerified,
  maskEmail,
} from "@/lib/email-verification";

let dataDir: string;

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "wassl-otp-"));
  process.env.WASSL_DATA_DIR = dataDir;
  process.env.WASSL_SECRET = "test-secret";
  delete process.env.WASSL_OTP_TEST_MODE;
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

async function freshDb() {
  const db = await import("@/lib/db");
  await db.resetDatabase();
  return db;
}

async function makeUnverified(
  db: Awaited<ReturnType<typeof freshDb>>,
  email = "verify@example.com",
) {
  return db.createAccount({
    email,
    name: "Verify Me",
    passwordHash: "not-a-real-hash",
    role: "customer",
  });
}

describe("verification code helpers", () => {
  it("generates a zero-padded six-digit code", () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generateVerificationCode()).toMatch(/^\d{6}$/);
    }
  });

  it("stores an HMAC, never the code", () => {
    const hash = hashVerificationCode("a@example.com", "123456");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain("123456");
    expect(codeMatches("a@example.com", "123456", hash)).toBe(true);
    expect(codeMatches("a@example.com", "654321", hash)).toBe(false);
    // The email is part of the hash, so a code cannot be replayed elsewhere.
    expect(codeMatches("b@example.com", "123456", hash)).toBe(false);
  });

  it("masks the address without hiding the domain", () => {
    expect(maskEmail("abbasidi0095@gmail.com")).toBe("ab**********@gmail.com");
    expect(maskEmail("a@b.co")).toBe("a**@b.co");
  });

  it("treats legacy accounts without a flag as verified", () => {
    expect(isEmailVerified({ emailVerified: undefined })).toBe(true);
    expect(isEmailVerified({ emailVerified: true })).toBe(true);
    expect(isEmailVerified({ emailVerified: false })).toBe(false);
  });
});

describe("email verification lifecycle", () => {
  it("marks self-service accounts unverified and keeps only a hash", async () => {
    const db = await freshDb();
    const user = await makeUnverified(db);
    expect(user.emailVerified).toBe(false);

    const issued = await db.issueEmailVerification(user.email);
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    expect(issued.code).toMatch(/^\d{6}$/);

    const stored = (await db.getDb()).users.find((item) => item.id === user.id);
    expect(stored?.emailVerification?.codeHash).toBe(
      hashVerificationCode(user.email, issued.code),
    );
    expect(JSON.stringify(stored)).not.toContain(issued.code);
  });

  it("rejects a wrong code and accepts the right one exactly once", async () => {
    const db = await freshDb();
    const user = await makeUnverified(db, "owner@example.com");
    const issued = await db.issueEmailVerification(user.email);
    if (!issued.ok) throw new Error("code was not issued");

    const wrong = await db.confirmEmailVerification(user.email, "000000");
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.failure).toBe("incorrect");

    const confirmed = await db.confirmEmailVerification(user.email, issued.code);
    expect(confirmed.ok).toBe(true);
    if (confirmed.ok) {
      expect(confirmed.user.emailVerified).toBe(true);
      expect(confirmed.user.emailVerifiedAt).toBeTruthy();
      expect(confirmed.user.emailVerification).toBeUndefined();
    }

    // A consumed code cannot open a second session.
    const replay = await db.confirmEmailVerification(user.email, issued.code);
    expect(replay.ok).toBe(false);
    if (!replay.ok) expect(replay.failure).toBe("already_verified");
  });

  it("expires a code after its window", async () => {
    const db = await freshDb();
    const user = await makeUnverified(db, "expired@example.com");
    const issued = await db.issueEmailVerification(user.email);
    if (!issued.ok) throw new Error("code was not issued");

    await db.mutate((database) => {
      const stored = database.users.find((item) => item.id === user.id)!;
      stored.emailVerification!.expiresAt = new Date(Date.now() - 1000).toISOString();
    });

    const result = await db.confirmEmailVerification(user.email, issued.code);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure).toBe("expired");
    const stored = (await db.getDb()).users.find((item) => item.id === user.id);
    expect(stored?.emailVerification).toBeUndefined();
  });

  it("invalidates the challenge after five wrong attempts", async () => {
    const db = await freshDb();
    const user = await makeUnverified(db, "locked@example.com");
    const issued = await db.issueEmailVerification(user.email);
    if (!issued.ok) throw new Error("code was not issued");

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const result = await db.confirmEmailVerification(user.email, "999999");
      expect(result.ok).toBe(false);
    }

    const afterLock = await db.confirmEmailVerification(user.email, issued.code);
    expect(afterLock.ok).toBe(false);
    if (!afterLock.ok) expect(afterLock.failure).toBe("no_code");
  });

  it("enforces the resend cooldown", async () => {
    const db = await freshDb();
    const user = await makeUnverified(db, "cooldown@example.com");
    expect((await db.issueEmailVerification(user.email)).ok).toBe(true);

    const immediate = await db.issueEmailVerification(user.email);
    expect(immediate.ok).toBe(false);
    if (!immediate.ok) {
      expect(immediate.failure).toBe("cooldown");
      expect(immediate.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it("limits an address to three sends per ten minutes", async () => {
    const db = await freshDb();
    const user = await makeUnverified(db, "rate@example.com");

    for (let send = 0; send < 3; send += 1) {
      expect((await db.issueEmailVerification(user.email)).ok).toBe(true);
      await db.mutate((database) => {
        const stored = database.users.find((item) => item.id === user.id)!;
        stored.emailVerification!.lastSentAt = new Date(
          Date.now() - 2 * 60 * 1000,
        ).toISOString();
      });
    }

    const blocked = await db.issueEmailVerification(user.email);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.failure).toBe("rate_limited");
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it("does not issue codes for unknown addresses", async () => {
    const db = await freshDb();
    const result = await db.issueEmailVerification("nobody@example.com");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure).toBe("not_found");
  });
});

describe("account approval", () => {
  it("never exposes password hashes to the admin console", async () => {
    const db = await freshDb();
    const users = await db.getUsers();
    expect(users.length).toBeGreaterThan(0);
    expect(users.every((user) => !("passwordHash" in user))).toBe(true);
  });

  it("attaches a store and makes the account a merchant", async () => {
    const db = await freshDb();
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
    const db = await freshDb();
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
    const db = await freshDb();
    const created = await db.upsertOtpUser({ email: "invalid@example.com" });
    await expect(
      db.updateUserAccess({ userId: created.id, storeId: "store_missing" }),
    ).rejects.toThrow(/Store not found/);
  });
});
