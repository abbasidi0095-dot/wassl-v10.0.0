import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPhoneTicket,
  isPhoneVerified,
  maskPhone,
  normalizeMoroccanPhone,
  verifyPhoneTicket,
} from "@/lib/phone";
import { hashVerificationCode } from "@/lib/email-verification";

let dataDir: string;

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "wassl-phone-"));
  process.env.WASSL_DATA_DIR = dataDir;
  process.env.WASSL_SECRET = "test-secret";
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe("Moroccan mobile numbers", () => {
  it("accepts the formats people type", () => {
    for (const input of [
      "0612345678",
      "06 12 34 56 78",
      "+212612345678",
      "+212 6 12 34 56 78",
      "00212612345678",
      "212612345678",
      "0712345678",
    ]) {
      expect(normalizeMoroccanPhone(input), input).toBe(
        input.startsWith("07") || input.includes("712345")
          ? "+212712345678"
          : "+212612345678",
      );
    }
  });

  it("rejects landlines and malformed numbers", () => {
    expect(normalizeMoroccanPhone("0522123456")).toBeNull();
    expect(normalizeMoroccanPhone("06123456")).toBeNull();
    expect(normalizeMoroccanPhone("+33612345678")).toBeNull();
    expect(normalizeMoroccanPhone("")).toBeNull();
  });

  it("masks the middle of the number", () => {
    expect(maskPhone("+212612345678")).toBe("+212 6•• ••• 78");
  });

  it("treats legacy accounts without a flag as verified", () => {
    expect(isPhoneVerified({ phoneVerified: undefined })).toBe(true);
    expect(isPhoneVerified({ phoneVerified: true })).toBe(true);
    expect(isPhoneVerified({ phoneVerified: false })).toBe(false);
  });

  it("signs short-lived tickets for the phone step", () => {
    const now = Date.now();
    const ticket = createPhoneTicket("owner@example.com", now);
    expect(verifyPhoneTicket("owner@example.com", ticket, now)).toBe(true);
    expect(verifyPhoneTicket("other@example.com", ticket, now)).toBe(false);
    expect(
      verifyPhoneTicket("owner@example.com", ticket, now + 16 * 60 * 1000),
    ).toBe(false);
    expect(verifyPhoneTicket("owner@example.com", "tampered", now)).toBe(false);
  });
});

describe("SMS verification lifecycle", () => {
  it("stores only a hash and verifies the mobile once", async () => {
    const db = await import("@/lib/db");
    await db.resetDatabase();
    const user = await db.createAccount({
      email: "mobile@example.com",
      name: "Mobile User",
      passwordHash: "hash",
      role: "customer",
      phone: "06 12 34 56 78",
    });
    expect(user.phone).toBe("+212612345678");
    expect(user.phoneVerified).toBe(false);

    const issued = await db.issuePhoneVerification(user.email);
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    expect(issued.code).toMatch(/^\d{6}$/);

    const stored = (await db.getDb()).users.find((item) => item.id === user.id);
    expect(stored?.phoneVerification?.codeHash).toBe(
      hashVerificationCode("+212612345678", issued.code),
    );
    expect(JSON.stringify(stored)).not.toContain(issued.code);

    const wrong = await db.confirmPhoneVerification(user.email, "000000");
    expect(wrong.ok).toBe(false);

    const confirmed = await db.confirmPhoneVerification(user.email, issued.code);
    expect(confirmed.ok).toBe(true);
    if (confirmed.ok) {
      expect(confirmed.user.phoneVerified).toBe(true);
      expect(confirmed.user.phoneVerifiedAt).toBeTruthy();
      expect(confirmed.user.phoneVerification).toBeUndefined();
    }

    const replay = await db.confirmPhoneVerification(user.email, issued.code);
    expect(replay.ok).toBe(false);
  });

  it("requires a valid mobile before issuing a code", async () => {
    const db = await import("@/lib/db");
    await db.resetDatabase();
    const user = await db.createAccount({
      email: "nomobile@example.com",
      name: "No Mobile",
      passwordHash: "hash",
      role: "customer",
    });
    const result = await db.issuePhoneVerification(user.email);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure).toBe("no_phone");
  });

  it("lets an admin verify a mobile as the manual fallback", async () => {
    const db = await import("@/lib/db");
    await db.resetDatabase();
    const user = await db.createAccount({
      email: "manual@example.com",
      name: "Manual User",
      passwordHash: "hash",
      role: "customer",
      phone: "0612345678",
    });
    const verified = await db.verifyUserPhoneByAdmin({
      userId: user.id,
      actor: { id: "user_admin", name: "Ops", role: "admin" },
    });
    expect(verified.phoneVerified).toBe(true);
    expect(verified.phoneVerifiedAt).toBeTruthy();
    const logs = await db.getAuditLogs({ entity: "auth", entityId: user.id });
    expect(
      logs.some((entry) => entry.action === "auth.phone_verified_admin"),
    ).toBe(true);
  });

  it("enforces the SMS resend cooldown", async () => {
    const db = await import("@/lib/db");
    await db.resetDatabase();
    const user = await db.createAccount({
      email: "smscool@example.com",
      name: "SMS Cool",
      passwordHash: "hash",
      role: "customer",
      phone: "0612345678",
    });
    expect((await db.issuePhoneVerification(user.email)).ok).toBe(true);
    const immediate = await db.issuePhoneVerification(user.email);
    expect(immediate.ok).toBe(false);
    if (!immediate.ok) expect(immediate.failure).toBe("cooldown");
  });
});
