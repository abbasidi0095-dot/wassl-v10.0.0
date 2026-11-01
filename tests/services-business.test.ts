import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OrderActor } from "@/lib/order-machine";

let dataDir: string;

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "wassl-services-"));
  process.env.WASSL_DATA_DIR = dataDir;
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

const admin: OrderActor = { role: "admin", id: "user_admin", name: "Ops" };

describe("local services", () => {
  it("books a provider and lets the provider confirm and complete", async () => {
    const db = await import("@/lib/db");
    await db.resetDatabase();
    const user = await db.getUserByEmail("customer@wassl.ma");
    const provider = (await db.getServiceProviders({ citySlug: "dakhla" }))[0];
    const booking = await db.createServiceBooking(
      {
        providerId: provider.id,
        service: "Wash and fold",
        description: "Two bags of laundry",
        address: "12 Rue de la Plage",
        landmark: "Lighthouse",
        date: "2026-12-02",
        slot: "09:00",
      },
      { role: "customer", id: user!.id, name: user!.name },
    );
    expect(booking.status).toBe("requested");
    const confirmed = await db.updateServiceBookingStatus(
      booking.id,
      "confirmed",
      { role: "merchant", id: "provider", name: provider.name },
      { accessCode: provider.accessCode },
    );
    expect(confirmed.status).toBe("confirmed");
    const completed = await db.updateServiceBookingStatus(
      booking.id,
      "completed",
      { role: "merchant", id: "provider", name: provider.name },
      { accessCode: provider.accessCode },
    );
    expect(completed.status).toBe("completed");
  });
});

describe("business accounts", () => {
  it("approves an account and creates a wholesale order", async () => {
    const db = await import("@/lib/db");
    await db.resetDatabase();
    const user = await db.getUserByEmail("customer@wassl.ma");
    const account = await db.applyBusinessAccount(
      {
        companyName: "Café Test",
        contactName: "Mariam",
        phone: "+212600000000",
        email: user!.email,
        citySlug: "dakhla",
        category: "Café",
      },
      { role: "customer", id: user!.id, name: user!.name },
    );
    expect(account.status).toBe("pending");
    await db.updateBusinessAccountStatus(account.id, "approved", admin);
    const product = (await db.getProducts("store_sahara_market")).find(
      (entry) => entry.id === "product_017",
    )!;
    const order = await db.createBusinessOrder(
      {
        storeId: "store_sahara_market",
        deliveryDate: "2026-12-03",
        items: [{ productId: product.id, qty: 10 }],
      },
      { role: "customer", id: user!.id, name: user!.name },
    );
    expect(order.items[0].qty).toBe(10);
    expect(order.items[0].unitPrice).toBeLessThan(product.price);
    expect(order.subtotal).toBe(order.items[0].qty * order.items[0].unitPrice);
  });
});
