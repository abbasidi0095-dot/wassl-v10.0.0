import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let dataDir: string;

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "wassl-auth-"));
  process.env.WASSL_DATA_DIR = dataDir;
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe("password accounts", () => {
  it("activates customers immediately", async () => {
    const db = await import("@/lib/db");
    const security = await import("@/lib/security");
    await db.resetDatabase();

    const user = await db.createAccount({
      email: "New.Customer@Example.com",
      name: "New Customer",
      passwordHash: security.hashPassword("Customer-Pass-1"),
      role: "customer",
      phone: "+212 600 000 001",
      citySlug: "dakhla",
    });

    expect(user.email).toBe("new.customer@example.com");
    expect(user.accountStatus).toBe("active");
    expect(db.effectiveAccountStatus(user)).toBe("active");
    expect(security.verifyPassword("Customer-Pass-1", user.passwordHash)).toBe(true);
    expect(security.verifyPassword("wrong", user.passwordHash)).toBe(false);
  });

  it("keeps store owners pending until approval provisions a store", async () => {
    const db = await import("@/lib/db");
    const security = await import("@/lib/security");
    await db.resetDatabase();

    const user = await db.createAccount({
      email: "pending-store@example.com",
      name: "Pending Store",
      passwordHash: security.hashPassword("Store-Pass-123"),
      role: "merchant",
      phone: "+212 600 000 002",
      citySlug: "laayoune",
      requestedStoreName: "Pending Kitchen",
    });

    expect(user.accountStatus).toBe("pending");
    expect(user.storeId).toBeUndefined();

    const approved = await db.approveUser({ userId: user.id });
    expect(approved.accountStatus).toBe("active");
    expect(approved.role).toBe("merchant");
    expect(approved.storeId).toBeTruthy();
    expect(approved.requestedStoreName).toBe("Pending Kitchen");

    const store = (await db.getDb()).stores.find(
      (candidate) => candidate.id === approved.storeId,
    );
    expect(store?.name).toBe("Pending Kitchen");
    expect(store?.citySlug).toBe("laayoune");
  });

  it("provisions a driver profile on approval", async () => {
    const db = await import("@/lib/db");
    const security = await import("@/lib/security");
    await db.resetDatabase();

    const user = await db.createAccount({
      email: "pending-driver@example.com",
      name: "Pending Driver",
      passwordHash: security.hashPassword("Driver-Pass-123"),
      role: "driver",
      phone: "+212 600 000 003",
      citySlug: "dakhla",
      requestedVehicle: "Car",
    });

    const approved = await db.approveUser({ userId: user.id });
    expect(approved.accountStatus).toBe("active");
    expect(approved.driverId).toBeTruthy();

    const driver = (await db.getDb()).drivers.find(
      (candidate) => candidate.id === approved.driverId,
    );
    expect(driver?.name).toBe("Pending Driver");
    expect(driver?.vehicle).toBe("Car");
  });

  it("rejects an account and blocks the status", async () => {
    const db = await import("@/lib/db");
    const security = await import("@/lib/security");
    await db.resetDatabase();

    const user = await db.createAccount({
      email: "reject-me@example.com",
      name: "Reject Me",
      passwordHash: security.hashPassword("Reject-Pass-1"),
      role: "merchant",
      phone: "+212 600 000 004",
      citySlug: "dakhla",
      requestedStoreName: "Rejected Store",
    });

    const rejected = await db.rejectUser({ userId: user.id });
    expect(rejected.accountStatus).toBe("rejected");
    await expect(db.rejectUser({ userId: "user_admin" })).rejects.toThrow(
      /cannot be rejected/i,
    );
  });

  it("provisions and signs in the operator account", async () => {
    const db = await import("@/lib/db");
    const security = await import("@/lib/security");
    const config = await import("@/lib/auth-config");
    await db.resetDatabase();

    const operator = await db.ensureBootstrapAdmin();
    expect(operator.role).toBe("admin");
    expect(operator.accountStatus).toBe("active");
    expect(
      security.verifyPassword(
        config.BOOTSTRAP_ADMIN_PASSWORD,
        operator.passwordHash,
      ),
    ).toBe(true);
  });

  it("refuses duplicate emails", async () => {
    const db = await import("@/lib/db");
    const security = await import("@/lib/security");
    await db.resetDatabase();

    await expect(
      db.createAccount({
        email: "store@wassl.ma",
        name: "Duplicate",
        passwordHash: security.hashPassword("Duplicate-Pass-1"),
        role: "customer",
      }),
    ).rejects.toThrow(/already exists/i);
  });
});
