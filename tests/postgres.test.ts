import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Integration coverage for the production Postgres backend.
 *
 * Set `TEST_DATABASE_URL` to a disposable Postgres database. CI provides one
 * through the `postgres` service container; locally:
 *
 *   TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/wassl_test \
 *     npm run test:pg
 */
const databaseUrl = process.env.TEST_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;
const stateId = `vitest-wassl-${process.pid}-${Date.now()}`;

type DbModule = typeof import("@/lib/db");

suite("postgres persistence backend", () => {
  let db: DbModule;
  let pool: import("pg").Pool;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.WASSL_DB = "postgres";
    process.env.WASSL_DB_STATE_ID = stateId;
    process.env.WASSL_PG_CACHE_MS = "0";
    vi.resetModules();
    db = await import("@/lib/db");
    const { Pool } = await import("pg");
    pool = new Pool({ connectionString: databaseUrl });
    await db.resetDatabase();
  });

  afterAll(async () => {
    if (db) await db.closeDb();
    if (pool) {
      await pool.query("DELETE FROM wassl_state WHERE id = $1", [stateId]);
      await pool.end();
    }
    delete process.env.DATABASE_URL;
    delete process.env.WASSL_DB;
    delete process.env.WASSL_DB_STATE_ID;
  });

  it("seeds and reads the same document through Postgres", async () => {
    const store = await db.getStore("dakhla-grill");
    expect(store?.name).toBe("Dakhla Grill");
    expect((await db.getCities()).length).toBeGreaterThan(200);

    const row = await pool.query(
      "SELECT data, updated_at FROM wassl_state WHERE id = $1",
      [stateId],
    );
    expect(row.rowCount).toBe(1);
    expect(row.rows[0].data.stores.length).toBeGreaterThan(10);
  });

  it("serialises concurrent writers without losing orders", async () => {
    const store = (await db.getStore("dakhla-grill"))!;
    const product = (await db.getProducts(store.id))[0];
    const before = (await db.getOrders()).length;

    const base = {
      citySlug: "dakhla",
      storeId: store.id,
      customerName: "Postgres Test",
      customerPhone: "+212 600 111 222",
      address: "12 Rue de la Plage",
      landmark: "Near the lighthouse",
      lat: 23.69,
      lng: -15.94,
      items: [{ productId: product.id, qty: 1 }],
    };

    const created = await Promise.all([
      db.createOrder(base),
      db.createOrder(base),
      db.createOrder(base),
    ]);

    const orders = await db.getOrders();
    expect(orders.length).toBe(before + 3);
    const ids = new Set(orders.map((order) => order.id));
    for (const order of created) expect(ids.has(order.id)).toBe(true);

    const logs = await db.getAuditLogs({ entity: "order", limit: 10 });
    const createdLogs = logs.filter((entry) =>
      created.some((order) => order.id === entry.entityId),
    );
    expect(createdLogs).toHaveLength(3);
  });

  it("rolls a failed mutation back atomically", async () => {
    const store = (await db.getStore("dakhla-grill"))!;
    const product = (await db.getProducts(store.id))[0];
    const before = await db.getOrders();

    await expect(
      db.createOrder({
        citySlug: "dakhla",
        storeId: store.id,
        customerName: "Rollback Test",
        customerPhone: "+212 600 111 333",
        address: "Address",
        landmark: "Landmark",
        lat: 23.69,
        lng: -15.94,
        items: [{ productId: product.id, qty: 1 }],
        promoCode: "NOT-A-CODE",
      }),
    ).rejects.toThrow(/not valid/i);

    const after = await db.getOrders();
    expect(after.length).toBe(before.length);
  });

  it("keeps audit entries and status transitions durable", async () => {
    const store = (await db.getStore("dakhla-grill"))!;
    const product = (await db.getProducts(store.id))[0];
    const order = await db.createOrder({
      citySlug: "dakhla",
      storeId: store.id,
      customerName: "Durable Test",
      customerPhone: "+212 600 111 444",
      address: "Address",
      landmark: "Landmark",
      lat: 23.69,
      lng: -15.94,
      items: [{ productId: product.id, qty: 1 }],
    });
    const merchant = {
      role: "merchant" as const,
      id: "user_merchant_dakhla",
      name: "Dakhla Grill",
      storeId: store.id,
    };
    await db.updateOrderStatus(order.id, "accepted", merchant);
    await db.updateOrderStatus(order.id, "preparing", merchant);

    const row = await pool.query(
      "SELECT data FROM wassl_state WHERE id = $1",
      [stateId],
    );
    const persisted = (
      row.rows[0].data.orders as { id: string; status: string }[]
    ).find((entry) => entry.id === order.id);
    expect(persisted?.status).toBe("preparing");

    const logs = await db.getAuditLogs({ entity: "order", entityId: order.id });
    expect(logs.map((entry) => entry.after)).toEqual([
      "preparing",
      "accepted",
      "placed",
    ]);
  });
});
