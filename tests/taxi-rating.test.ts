import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OrderActor } from "@/lib/order-machine";
import type { Session } from "@/lib/types";

let dataDir: string;

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "wassl-taxi-rating-"));
  process.env.WASSL_DATA_DIR = dataDir;
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe("taxi ratings", () => {
  it("accepts one rating after completion and updates the driver average", async () => {
    const db = await import("@/lib/db");
    await db.resetDatabase();
    const user = await db.getUserByEmail("customer@wassl.ma");
    const customer: Session = {
      userId: user!.id,
      role: "customer",
      name: user!.name,
      email: user!.email,
      status: "active",
    };
    const driver = (await db.getDrivers("dakhla")).find((entry) => entry.active)!;
    const driverSession: Session = {
      userId: "user_driver",
      role: "driver",
      name: driver.name,
      driverId: driver.id,
      status: "active",
    };
    const admin: OrderActor = { role: "admin", id: "user_admin", name: "Ops" };

    const ride = await db.createTaxiRide(
      {
        citySlug: "dakhla",
        pickupLabel: "A",
        dropoffLabel: "B",
        pickupLat: 23.69,
        pickupLng: -15.94,
        dropoffLat: 23.68,
        dropoffLng: -15.95,
      },
      { role: "customer", id: user!.id, name: user!.name },
    );
    await db.updateTaxiRideStatus(ride.id, "accepted", {
      role: "driver",
      id: "user_driver",
      name: driver.name,
      driverId: driver.id,
    });
    await db.updateTaxiRideStatus(ride.id, "arriving", {
      role: "driver",
      id: "user_driver",
      name: driver.name,
      driverId: driver.id,
    });
    await db.updateTaxiRideStatus(ride.id, "in_progress", {
      role: "driver",
      id: "user_driver",
      name: driver.name,
      driverId: driver.id,
    });
    await db.updateTaxiRideStatus(ride.id, "completed", admin);

    const rated = await db.rateTaxiRide(ride.id, customer, 5, "Smooth ride");
    expect(rated.rating?.stars).toBe(5);
    await expect(db.rateTaxiRide(ride.id, customer, 4)).rejects.toThrow(/already/i);

    const updatedDriver = await db.getDriver(driver.id);
    expect(updatedDriver!.ratingsCount).toBeGreaterThan(0);
  });
});

describe("Taxi 2.0", () => {
  it("stores scheduled intercity requests, stops and a share token", async () => {
    const db = await import("@/lib/db");
    await db.resetDatabase();
    const user = await db.getUserByEmail("customer@wassl.ma");
    const ride = await db.createTaxiRide(
      {
        citySlug: "dakhla",
        pickupLabel: "Dakhla",
        dropoffLabel: "Laâyoune",
        pickupLat: 23.69,
        pickupLng: -15.94,
        dropoffLat: 27.15,
        dropoffLng: -13.19,
        rideType: "intercity",
        scheduledFor: "2026-12-01T09:00:00.000Z",
        stops: [{ label: "Boujdour", lat: 26.12, lng: -14.48 }],
        passengerCount: 3,
        luggage: "2 suitcases",
        notes: "Family trip",
      },
      { role: "customer", id: user!.id, name: user!.name },
    );
    expect(ride.rideType).toBe("intercity");
    expect(ride.scheduledFor).toBe("2026-12-01T09:00:00.000Z");
    expect(ride.stops?.[0]?.label).toBe("Boujdour");
    expect(ride.passengerCount).toBe(3);
    expect(ride.shareToken).toBeTruthy();
    expect(await db.getTaxiRideByShareToken(ride.shareToken!)).toBeTruthy();
  });

  it("reports a lost item after a completed ride", async () => {
    const db = await import("@/lib/db");
    await db.resetDatabase();
    const user = await db.getUserByEmail("customer@wassl.ma");
    const ride = await db.createTaxiRide(
      {
        citySlug: "dakhla",
        pickupLabel: "A",
        dropoffLabel: "B",
        pickupLat: 23.69,
        pickupLng: -15.94,
        dropoffLat: 23.68,
        dropoffLng: -15.95,
      },
      { role: "customer", id: user!.id, name: user!.name },
    );
    await db.updateTaxiRideStatus(ride.id, "accepted", {
      role: "driver",
      id: "user_driver",
      name: "Driver",
      driverId: "driver_youssef",
    });
    await db.updateTaxiRideStatus(ride.id, "arriving", {
      role: "driver",
      id: "user_driver",
      name: "Driver",
      driverId: "driver_youssef",
    });
    await db.updateTaxiRideStatus(ride.id, "in_progress", {
      role: "driver",
      id: "user_driver",
      name: "Driver",
      driverId: "driver_youssef",
    });
    await db.updateTaxiRideStatus(ride.id, "completed", {
      role: "admin",
      id: "user_admin",
      name: "Ops",
    });
    const reported = await db.reportTaxiLostItem(
      ride.id,
      { role: "customer", id: user!.id, name: user!.name },
      { description: "Blue umbrella", contact: "+212600000000" },
    );
    expect(reported.lostItem?.description).toBe("Blue umbrella");
    const resolved = await db.resolveTaxiLostItem(ride.id, {
      role: "admin",
      id: "user_admin",
      name: "Ops",
    });
    expect(resolved.lostItem?.status).toBe("resolved");
  });
});
