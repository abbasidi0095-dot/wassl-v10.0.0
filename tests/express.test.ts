import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OrderActor } from "@/lib/order-machine";

let dataDir: string;

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "wassl-express-"));
  process.env.WASSL_DATA_DIR = dataDir;
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

const admin: OrderActor = { role: "admin", id: "user_admin", name: "Ops" };

describe("Wassl Express", () => {
  it("books a parcel, verifies both codes and pays the driver", async () => {
    const db = await import("@/lib/db");
    await db.resetDatabase();
    const user = await db.getUserByEmail("customer@wassl.ma");
    const driver = (await db.getDrivers("dakhla")).find((entry) => entry.active)!;
    const customer: OrderActor = { role: "customer", id: user!.id, name: user!.name };
    const driverActor: OrderActor = {
      role: "driver",
      id: "user_driver",
      name: driver.name,
      driverId: driver.id,
    };

    const parcel = await db.createParcel(
      {
        citySlug: "dakhla",
        customerName: user!.name,
        customerPhone: "+212600000000",
        customerEmail: user!.email,
        pickupLabel: "Avenue Mohammed V",
        pickupLat: 23.69,
        pickupLng: -15.94,
        dropoffLabel: "Corniche",
        dropoffLat: 23.68,
        dropoffLng: -15.95,
        recipientName: "Youssef",
        recipientPhone: "+212611111111",
        size: "small",
        description: "Documents",
      },
      customer,
    );
    expect(parcel.status).toBe("requested");
    expect(parcel.fare).toBeGreaterThan(0);
    expect(parcel.pickupCode).toMatch(/^\d{4}$/);
    expect(db.parcelForDriver(parcel)).not.toHaveProperty("pickupCode");
    expect(db.parcelForDriver(parcel)).not.toHaveProperty("deliveryCode");

    await db.updateParcelStatus(parcel.id, "accepted", driverActor);
    await expect(
      db.updateParcelStatus(parcel.id, "picked_up", driverActor, { proofCode: "0000" }),
    ).rejects.toThrow(/pickup code/i);
    await db.updateParcelStatus(parcel.id, "picked_up", driverActor, {
      proofCode: parcel.pickupCode,
    });
    await db.updateParcelStatus(parcel.id, "in_transit", driverActor);
    await expect(
      db.updateParcelStatus(parcel.id, "delivered", driverActor, { proofCode: "0000" }),
    ).rejects.toThrow(/delivery code/i);
    const cashBefore = driver.cashOnHand;
    await db.updateParcelStatus(parcel.id, "delivered", driverActor, {
      proofCode: parcel.deliveryCode,
    });
    const updatedDriver = await db.getDriver(driver.id);
    expect(updatedDriver!.cashOnHand).toBe(cashBefore + parcel.fare);
  });

  it("lets operations assign a parcel and the customer cancel", async () => {
    const db = await import("@/lib/db");
    await db.resetDatabase();
    const user = await db.getUserByEmail("customer@wassl.ma");
    const driver = (await db.getDrivers("dakhla")).find((entry) => entry.active)!;
    const parcel = await db.createParcel(
      {
        citySlug: "dakhla",
        customerName: user!.name,
        customerPhone: "+212600000000",
        customerEmail: user!.email,
        pickupLabel: "A",
        pickupLat: 23.69,
        pickupLng: -15.94,
        dropoffLabel: "B",
        dropoffLat: 23.68,
        dropoffLng: -15.95,
        recipientName: "Sara",
        recipientPhone: "+212622222222",
        size: "document",
        description: "Envelope",
      },
      { role: "customer", id: user!.id, name: user!.name },
    );
    const assigned = await db.assignParcelDriver(parcel.id, driver.id, admin);
    expect(assigned.status).toBe("accepted");
    const cancelled = await db.updateParcelStatus(parcel.id, "cancelled", {
      role: "customer",
      id: user!.id,
      name: user!.name,
    });
    expect(cancelled.status).toBe("cancelled");
  });
});
