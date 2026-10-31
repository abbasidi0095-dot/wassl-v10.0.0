import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let dataDir: string;
const token = "guest-token-0123456789abcdef";

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "wassl-addr-"));
  process.env.WASSL_DATA_DIR = dataDir;
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

async function freshDb() {
  return import("@/lib/db");
}

const address = {
  token,
  name: "Test Customer",
  phone: "+212 600 000 000",
  address: "12 Rue de la Plage",
  landmark: "Near the lighthouse",
  lat: 23.69,
  lng: -15.94,
};

describe("guest address book", () => {
  it("saves, deduplicates and deletes addresses", async () => {
    const db = await freshDb();
    await db.resetDatabase();

    const first = await db.saveAddress(address);
    expect(await db.getAddresses(token)).toHaveLength(1);
    expect(first.label).toBe("Home");

    const again = await db.saveAddress({ ...address, label: "Beach" });
    expect(await db.getAddresses(token)).toHaveLength(1);
    expect(again.id).toBe(first.id);
    expect(again.label).toBe("Beach");

    expect(await db.deleteAddress(token, first.id)).toBe(true);
    expect(await db.getAddresses(token)).toHaveLength(0);
  });

  it("scopes addresses to their browser token", async () => {
    const db = await freshDb();
    await db.resetDatabase();
    await db.saveAddress(address);

    expect(await db.getAddresses("another-token-0123456789")).toHaveLength(0);
    expect(await db.getAddresses("short")).toHaveLength(0);
  });

  it("caps the address book at ten entries", async () => {
    const db = await freshDb();
    await db.resetDatabase();
    for (let index = 0; index < 12; index += 1) {
      await db.saveAddress({
        ...address,
        address: `${index} Rue de la Plage`,
        landmark: `Landmark ${index}`,
      });
    }
    expect(await db.getAddresses(token)).toHaveLength(10);
  });
});
