import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OrderActor } from "@/lib/order-machine";

let dataDir: string;

const customer: OrderActor = {
  role: "customer",
  id: "user_customer_demo",
  name: "Mariam K.",
};
const driver: OrderActor = {
  role: "driver",
  id: "user_driver_youssef",
  name: "Youssef",
  driverId: "driver_youssef",
};

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "wassl-handover-"));
  process.env.WASSL_DATA_DIR = dataDir;
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe("four-digit handover codes", () => {
  it("requires the ride code before a taxi trip can be completed", async () => {
    const db = await import("@/lib/db");
    await db.resetDatabase();

    const ride = await db.createTaxiRide(
      {
        citySlug: "dakhla",
        pickupLabel: "Avenue Mohammed V",
        dropoffLabel: "Marina",
        pickupLat: 23.6848,
        pickupLng: -15.958,
        dropoffLat: 23.7,
        dropoffLng: -15.94,
      },
      customer,
    );
    expect(ride.verificationCode).toMatch(/^\d{4}$/);
    expect(ride.handoverRequired).toBe(true);

    await db.updateTaxiRideStatus(ride.id, "accepted", driver);
    await db.updateTaxiRideStatus(ride.id, "arriving", driver);
    await db.updateTaxiRideStatus(ride.id, "in_progress", driver);

    await expect(
      db.updateTaxiRideStatus(ride.id, "completed", driver, { proofCode: "0000" }),
    ).rejects.toThrow(/ride code/i);

    const done = await db.updateTaxiRideStatus(ride.id, "completed", driver, {
      proofCode: ride.verificationCode,
    });
    expect(done.status).toBe("completed");
    expect(done.codeVerifiedAt).toBeTruthy();
  });

  it("provisions a driver account with a generated login", async () => {
    const db = await import("@/lib/db");
    await db.resetDatabase();
    const admin: OrderActor = { role: "admin", id: "user_admin", name: "Ops" };
    const result = await db.createDriverAccount(
      {
        name: "Test Taxi",
        phone: "+212600000000",
        citySlug: "dakhla",
        kind: "taxi",
        vehicle: "Dacia Logan",
        plate: "TEST-123",
      },
      admin,
    );
    expect(result.email).toContain("@wassl.ma");
    expect(result.password.length).toBeGreaterThanOrEqual(8);
    expect(result.driver.kind).toBe("taxi");
    expect(result.driver.photo).toBeUndefined();
    const user = await db.getUserByEmail(result.email);
    expect(user?.accountStatus).toBe("active");
    expect(user?.emailVerified).toBe(true);
  });
});
