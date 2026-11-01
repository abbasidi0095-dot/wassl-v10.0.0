import fs from "node:fs";
import path from "node:path";
import type { Database } from "./types";
import { createSeedDatabase, groceryExtra } from "./seed";
import { GROCERY_PRESETS } from "./grocery-presets";
import { defaultGrocerySettings } from "./grocery";
import { defaultCityServices } from "./city-services";
import { DEFAULT_GROCERY_PROMOTIONS } from "./grocery-promotions";
import {
  DEFAULT_LOYALTY_REWARDS,
  makeReferralCode,
  tierForLifetime,
} from "./loyalty";

/**
 * Persistence backends.
 *
 * The application model is a single `Database` document. Two drivers implement
 * the same contract:
 *
 * - `json` keeps the zero-config demo working (one file, atomic rename).
 * - `postgres` stores the document in a `jsonb` row and serialises writers with
 *   `SELECT … FOR UPDATE`. This is the production path: it is durable,
 *   transactional and safe when several app instances share one database.
 *
 * A future iteration can normalise the document into relational tables without
 * changing the public `db.ts` API; the rest of the app only depends on this
 * contract.
 */
export interface DatabaseBackend {
  readonly kind: "json" | "postgres";
  load(): Promise<Database>;
  mutate<T>(fn: (db: Database) => T): Promise<T>;
  reset(): Promise<Database>;
}

const globalForDb = globalThis as unknown as {
  __wasslJsonDb?: Database;
  __wasslJsonDir?: string;
  __wasslPgPool?: import("pg").Pool;
  __wasslPgSchema?: Promise<void>;
  __wasslPgCache?: { db: Database; expiresAt: number };
};

/* -------------------------------------------------------------------------- */
/* JSON backend                                                               */
/* -------------------------------------------------------------------------- */

const dataDir = process.env.WASSL_DATA_DIR || path.join(process.cwd(), "data");
const dbFile = path.join(dataDir, "db.json");

function ensureDir() {
  if (!fs.existsSync(/*turbopackIgnore: true*/ dataDir)) {
    fs.mkdirSync(/*turbopackIgnore: true*/ dataDir, { recursive: true });
  }
}

function hydrate(db: Database): Database {
  db.addresses ??= [];
  db.auditLogs ??= [];
  db.stockReservations ??= [];
  db.refundRequests ??= [];
  db.pushSubscriptions ??= [];
  db.taxiRides ??= [];
  if (
    db.settings.primaryColor === "#0f6e6e" ||
    db.settings.primaryColor === "#0b4a45"
  ) {
    db.settings.primaryColor = "#153f37";
  }
  if (db.settings.accentColor === "#955b0b") {
    db.settings.accentColor = "#e6a23a";
  }
  db.settings.accentColor ??= "#e6a23a";
  db.settings.themePreset ??= "coastal";
  db.settings.defaultTheme ??= "system";
  db.promotions ??= DEFAULT_GROCERY_PROMOTIONS.map((promotion) => ({ ...promotion }));
  db.loyaltyAccounts ??= [];
  db.loyaltyTransactions ??= [];
  db.loyaltyRewards ??= DEFAULT_LOYALTY_REWARDS.map((reward) => ({ ...reward }));
  db.chatThreads ??= [];
  db.chatMessages ??= [];
  db.parcels ??= [];

  // Migrate the legacy scalar balance into an immutable, ledger-backed account.
  for (const user of db.users) {
    let account = db.loyaltyAccounts.find((entry) => entry.userId === user.id);
    if (!account) {
      const points = Math.max(0, user.loyaltyPoints ?? 0);
      account = {
        userId: user.id,
        points,
        lifetimePoints: points,
        tier: tierForLifetime(points),
        referralCode: makeReferralCode(user.id),
        joinedAt: user.createdAt ?? new Date().toISOString(),
      };
      db.loyaltyAccounts.push(account);
      if (points > 0) {
        db.loyaltyTransactions.push({
          id: `loyalty_opening_${user.id}`,
          userId: user.id,
          type: "adjust",
          points,
          balanceAfter: points,
          lifetimeAfter: points,
          note: "Opening balance migrated from the previous points field",
          createdAt: new Date().toISOString(),
        });
      }
    }
    account.tier = tierForLifetime(account.lifetimePoints);
    user.loyaltyPoints = account.points;
  }

  // City services are additive: existing cities keep their current three
  // verticals and new verticals stay off until an operator enables them.
  for (const city of db.cities) {
    const defaults = defaultCityServices(city);
    if ((city.servicesVersion ?? 1) < 2) {
      // Express becomes a default live-city service in v11. Future operator
      // changes are preserved because the migration only runs once.
      city.services = { ...defaults, ...(city.services ?? {}), express: defaults.express };
      city.servicesVersion = 2;
    } else {
      city.services = { ...defaults, ...(city.services ?? {}) };
    }
  }

  // Give existing records a handover code once. The code is persisted on the
  // next mutation; until then the in-memory view is still consistent.
  const code = () => String(1000 + Math.floor(Math.random() * 9000));
  for (const order of db.orders) {
    if (!order.deliveryPin) {
      const pin = code();
      order.deliveryPin = pin;
      if (order.fulfillment === "pickup" && !order.pickupCode) {
        order.pickupCode = `P${pin}`;
      }
      order.handoverRequired = true;
    }
  }
  for (const ride of db.taxiRides) {
    if (!ride.verificationCode) {
      ride.verificationCode = code();
      ride.handoverRequired = true;
    }
  }

  // Backfill older documents with grocery settings and SKU/stock fields. This
  // is intentionally additive and never touches locked snapshot products.
  for (const store of db.stores) {
    if (store.category !== "grocery") continue;
    store.grocery ??= GROCERY_PRESETS[store.slug] ?? defaultGrocerySettings(store);
  }
  const groceryIds = new Set(
    db.stores.filter((store) => store.category === "grocery").map((store) => store.id),
  );
  let migrated = 0;
  for (const product of db.products) {
    if (!groceryIds.has(product.storeId) || product.locked) continue;
    if (product.stock !== undefined && product.sku) continue;
    const prefix =
      db.stores.find((store) => store.id === product.storeId)?.slug
        .slice(0, 3)
        .toUpperCase() || "GRO";
    product.sku ??= `${prefix}-${String(product.id).slice(-6).toUpperCase()}`;
    product.barcode ??= `61112${String(product.id).replace(/\D/g, "").slice(-8).padStart(8, "0")}`;
    product.unit ??= /\d+\s?(kg|g|l|ml|cl)/i.exec(product.name)?.[1] || "each";
    product.stock ??= 18;
    product.lowStockThreshold ??= 5;
    product.aisle ??= product.category;
    product.substitutionAllowed ??= true;
    migrated += 1;
  }
  let added = 0;
  for (const [index, item] of groceryExtra.entries()) {
    const exists = db.products.some(
      (product) => product.storeId === item.storeId && product.sku === item.sku,
    );
    if (exists) continue;
    db.products.push({
      ...item,
      id: `product_migrated_${index + 1}`,
      available: true,
      emoji: "",
      variants: item.variants?.map((variant) => ({ ...variant })),
    });
    added += 1;
  }
  if (migrated || added) {
    // Persisted on the next mutation; the in-memory view is correct now.
    console.info(
      `[grocery] backfilled ${migrated} products, added ${added} catalogue items`,
    );
  }
  return db;
}

function saveJson(db: Database) {
  ensureDir();
  const temp = `${dbFile}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(db, null, 2), "utf8");
  fs.renameSync(temp, dbFile);
  globalForDb.__wasslJsonDb = db;
  globalForDb.__wasslJsonDir = dataDir;
}

const jsonBackend: DatabaseBackend = {
  kind: "json",
  async load() {
    // `dataDir` is fixed at module load; the guard keeps tests that point at a
    // new WASSL_DATA_DIR from reusing another directory's cached document.
    if (
      globalForDb.__wasslJsonDb &&
      globalForDb.__wasslJsonDir === dataDir
    ) {
      return globalForDb.__wasslJsonDb;
    }
    if (fs.existsSync(/*turbopackIgnore: true*/ dbFile)) {
      try {
        const existing = hydrate(
          JSON.parse(
            fs.readFileSync(/*turbopackIgnore: true*/ dbFile, "utf8"),
          ) as Database,
        );
        // Persist migrations (handover codes, grocery fields) immediately so a
        // restart cannot change a customer's code mid-delivery.
        saveJson(existing);
        return existing;
      } catch {
        // fall through to a clean seed if the local demo file is corrupt
      }
    }
    const seeded = createSeedDatabase();
    saveJson(seeded);
    return seeded;
  },
  async mutate<T>(fn: (db: Database) => T): Promise<T> {
    const db = await jsonBackend.load();
    const result = fn(db);
    saveJson(db);
    return result;
  },
  async reset() {
    const seeded = createSeedDatabase();
    saveJson(seeded);
    return seeded;
  },
};

/* -------------------------------------------------------------------------- */
/* Postgres backend                                                           */
/* -------------------------------------------------------------------------- */

const PG_STATE_ID = process.env.WASSL_DB_STATE_ID || "platform";

function stateId() {
  return process.env.WASSL_DB_STATE_ID || PG_STATE_ID;
}

async function getPool() {
  if (globalForDb.__wasslPgPool) return globalForDb.__wasslPgPool;
  const { Pool } = await import("pg");
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for the Postgres backend");
  }
  const sslMode = process.env.DATABASE_SSL;
  const pool = new Pool({
    connectionString,
    max: Math.max(1, Number(process.env.WASSL_PG_POOL_MAX || 5)),
    application_name: "wassl",
    ssl:
      sslMode === "no-verify"
        ? { rejectUnauthorized: false }
        : sslMode === "true"
          ? true
          : undefined,
  });
  globalForDb.__wasslPgPool = pool;
  return pool;
}

async function ensureSchema() {
  if (globalForDb.__wasslPgSchema) return globalForDb.__wasslPgSchema;
  globalForDb.__wasslPgSchema = (async () => {
    const pool = await getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS wassl_state (
        id text PRIMARY KEY,
        data jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
  })().catch((error) => {
    // A transient startup failure must not poison every later request.
    globalForDb.__wasslPgSchema = undefined;
    throw error;
  });
  return globalForDb.__wasslPgSchema;
}

function cacheDb(db: Database) {
  globalForDb.__wasslPgCache = {
    db,
    expiresAt: Date.now() + Math.max(0, Number(process.env.WASSL_PG_CACHE_MS || 0)),
  };
}

function invalidateCache() {
  globalForDb.__wasslPgCache = undefined;
}

async function insertSeedIfMissing(
  query: (text: string, values?: unknown[]) => Promise<{ rowCount: number | null; rows: unknown[] }>,
) {
  const seeded = createSeedDatabase();
  await query(
    `INSERT INTO wassl_state (id, data)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [stateId(), JSON.stringify(seeded)],
  );
  return seeded;
}


const postgresBackend: DatabaseBackend = {
  kind: "postgres",
  async load() {
    const cached = globalForDb.__wasslPgCache;
    if (cached && cached.expiresAt > Date.now()) return cached.db;

    await ensureSchema();
    const pool = await getPool();
    const id = stateId();
    const existing = await pool.query(
      "SELECT data FROM wassl_state WHERE id = $1",
      [id],
    );
    if (existing.rowCount) {
      const db = hydrate(existing.rows[0].data as Database);
      cacheDb(db);
      return db;
    }

    await insertSeedIfMissing((text, values) => pool.query(text, values));
    const seededRow = await pool.query(
      "SELECT data FROM wassl_state WHERE id = $1",
      [id],
    );
    const db = hydrate(seededRow.rows[0].data as Database);
    cacheDb(db);
    return db;
  },
  async mutate<T>(fn: (db: Database) => T): Promise<T> {
    await ensureSchema();
    const pool = await getPool();
    const client = await pool.connect();
    const id = stateId();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL statement_timeout = '15000'");
      // A single serialisation point keeps the document consistent across app
      // instances. Writers queue behind this row lock; reads stay lock-free.
      let row = await client.query(
        "SELECT data FROM wassl_state WHERE id = $1 FOR UPDATE",
        [id],
      );
      if (!row.rowCount) {
        await insertSeedIfMissing((text, values) => client.query(text, values));
        row = await client.query(
          "SELECT data FROM wassl_state WHERE id = $1 FOR UPDATE",
          [id],
        );
      }
      const db = hydrate(row.rows[0].data as Database);
      const result = fn(db);
      await client.query(
        `UPDATE wassl_state
         SET data = $2::jsonb, updated_at = now()
         WHERE id = $1`,
        [id, JSON.stringify(db)],
      );
      await client.query("COMMIT");
      cacheDb(db);
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  },
  async reset() {
    await ensureSchema();
    const pool = await getPool();
    const seeded = createSeedDatabase();
    await pool.query(
      `INSERT INTO wassl_state (id, data)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (id) DO UPDATE
       SET data = EXCLUDED.data, updated_at = now()`,
      [stateId(), JSON.stringify(seeded)],
    );
    cacheDb(seeded);
    return seeded;
  },
};

/* -------------------------------------------------------------------------- */
/* Selection                                                                  */
/* -------------------------------------------------------------------------- */

export function getDatabaseBackend(): DatabaseBackend {
  if (process.env.WASSL_DB === "json") return jsonBackend;
  return process.env.DATABASE_URL ? postgresBackend : jsonBackend;
}

/** Test/CLI helper: close the shared pool so Node can exit cleanly. */
export async function closeDatabase(): Promise<void> {
  const pool = globalForDb.__wasslPgPool;
  globalForDb.__wasslPgPool = undefined;
  globalForDb.__wasslPgSchema = undefined;
  invalidateCache();
  if (pool) await pool.end();
}
