import { notifyOrderStatusChange } from "./email";
import { closeDatabase, getDatabaseBackend } from "./db-backend";
import {
  discardEventBatch,
  flushEventBatch,
  publish,
  runWithEventBatch,
} from "./events";
import { hashPassword, orderCode, randomId, verifyPassword } from "./security";
import { estimateTaxiFare, haversineKm, TAXI_TRANSITIONS } from "./taxi";
import {
  BOOTSTRAP_ADMIN_EMAIL,
  BOOTSTRAP_ADMIN_PASSWORD,
  DEMO_CUSTOMER_EMAIL,
  DEMO_CUSTOMER_PASSWORD,
  DEMO_DRIVER_EMAIL,
  DEMO_DRIVER_PASSWORD,
  DEMO_STORE_EMAIL,
  DEMO_STORE_PASSWORD,
} from "./auth-config";
import {
  checkTransition,
  OrderRuleError,
  type OrderActor,
} from "./order-machine";
import type {
  AccountStatus,
  AuditEntity,
  AuditEntry,
  City,
  CustomerAddress,
  Database,
  DeviceToken,
  Driver,
  Order,
  OrderEvent,
  OrderStatus,
  PlatformSettings,
  Product,
  PushSubscriptionRecord,
  Role,
  Store,
  TaxiRide,
  TaxiStatus,
  User,
} from "./types";
import { STATUS_META } from "./types";
import { quotePromo } from "./promos";
import { DIETARY_TAGS } from "./utils";

export function getDb(): Promise<Database> {
  return getDatabaseBackend().load();
}

export function mutate<T>(fn: (db: Database) => T): Promise<T> {
  return runWithEventBatch(async () => {
    try {
      const result = await getDatabaseBackend().mutate(fn);
      flushEventBatch();
      return result;
    } catch (error) {
      discardEventBatch();
      throw error;
    }
  });
}

export async function resetDatabase() {
  const seeded = await getDatabaseBackend().reset();
  publish({ type: "settings" });
  return seeded;
}

/** Test/CLI helper: release the Postgres pool. */
export const closeDb = closeDatabase;

const AUDIT_LIMIT = 500;

export function recordAudit(
  db: Database,
  entry: Omit<AuditEntry, "id" | "at">,
): AuditEntry {
  const full: AuditEntry = {
    id: randomId("log", 6),
    at: new Date().toISOString(),
    ...entry,
  };
  db.auditLogs.unshift(full);
  if (db.auditLogs.length > AUDIT_LIMIT) db.auditLogs.length = AUDIT_LIMIT;
  return full;
}

export async function getAuditLogs(filter?: {
  entity?: AuditEntity;
  entityId?: string;
  limit?: number;
}): Promise<AuditEntry[]> {
  const logs = (await getDb()).auditLogs;
  const filtered = filter?.entity
    ? logs.filter(
        (entry) =>
          entry.entity === filter.entity &&
          (!filter.entityId || entry.entityId === filter.entityId),
      )
    : logs;
  return filtered.slice(0, Math.max(1, Math.min(filter?.limit ?? 100, AUDIT_LIMIT)));
}

/* -------------------------------------------------------------------------- */
/*  Email OTP accounts                                                        */
/* -------------------------------------------------------------------------- */

export async function getUserByEmail(
  email: string,
): Promise<User | undefined> {
  const normalized = email.trim().toLowerCase();
  return (await getDb()).users.find(
    (user) => user.email.toLowerCase() === normalized,
  );
}

export async function getUserById(id: string): Promise<User | undefined> {
  return (await getDb()).users.find((user) => user.id === id);
}

/**
 * Legacy accounts predate the explicit status column. A staff account is
 * considered approved only when it already has the profile it needs.
 */
export function effectiveAccountStatus(user: User): AccountStatus {
  if (user.accountStatus) return user.accountStatus;
  if (user.role === "admin" || user.role === "customer") return "active";
  if (user.role === "merchant") return user.storeId ? "active" : "pending";
  return user.driverId ? "active" : "pending";
}

/** Create a self-service account. Store owners and drivers start pending. */
export async function createAccount(input: {
  email: string;
  name: string;
  passwordHash: string;
  role: Extract<Role, "customer" | "merchant" | "driver">;
  phone?: string;
  citySlug?: string;
  requestedStoreName?: string;
  requestedVehicle?: string;
}): Promise<User> {
  return mutate((db) => {
    const email = input.email.trim().toLowerCase();
    if (db.users.some((user) => user.email.toLowerCase() === email)) {
      throw new Error("An account with this email already exists");
    }

    const user: User = {
      id: randomId("user", 8),
      email,
      passwordHash: input.passwordHash,
      name: input.name.trim(),
      role: input.role,
      phone: input.phone?.trim() || undefined,
      citySlug: input.citySlug || undefined,
      requestedStoreName: input.requestedStoreName?.trim() || undefined,
      requestedVehicle: input.requestedVehicle?.trim() || undefined,
      accountStatus: input.role === "customer" ? "active" : "pending",
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);

    recordAudit(db, {
      action: "auth.signup",
      entity: "auth",
      entityId: user.id,
      summary: `${user.name} signed up as ${user.role}`,
      after: user.accountStatus,
      actorRole: "system",
      actorName: user.name,
    });
    return user;
  });
}

/**
 * Guarantees the operator account exists. This is how an existing database
 * (created before password login) gets working admin credentials.
 */
export async function ensureBootstrapAdmin(): Promise<User> {
  return mutate((db) => {
    const email = BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase();
    const existing = db.users.find(
      (user) => user.email.toLowerCase() === email,
    );

    let operator: User;
    if (existing) {
      if (existing.role === "admin") {
        if (
          !existing.passwordHash ||
          (process.env.WASSL_ADMIN_PASSWORD &&
            !verifyPassword(BOOTSTRAP_ADMIN_PASSWORD, existing.passwordHash))
        ) {
          existing.passwordHash = hashPassword(BOOTSTRAP_ADMIN_PASSWORD);
        }
        existing.accountStatus = "active";
      }
      operator = existing;
    } else {
      operator = {
        id: "user_operator",
        email,
        passwordHash: hashPassword(BOOTSTRAP_ADMIN_PASSWORD),
        name: "Wassl Operations",
        role: "admin",
        accountStatus: "active",
        createdAt: new Date().toISOString(),
      };
      db.users.push(operator);
      recordAudit(db, {
        action: "auth.admin_bootstrap",
        entity: "auth",
        entityId: operator.id,
        summary: "Operator account provisioned",
        actorRole: "system",
      });
    }

    // The pre-password build shipped a seeded `admin@wassl.ma` account with no
    // credentials. Disable it when the operator uses a different address so the
    // deployment has a single, working administrator.
    if (email !== "admin@wassl.ma") {
      const legacyAdmin = db.users.find(
        (user) => user.email.toLowerCase() === "admin@wassl.ma",
      );
      if (legacyAdmin) {
        legacyAdmin.accountStatus = "rejected";
      }
    }

    // Demo databases created before password login have empty password hashes
    // for the seeded store and driver accounts. Backfill those once so the
    // documented demo sign-ins keep working after this upgrade.
    const demoCredentials = [
      {
        email: DEMO_STORE_EMAIL,
        password: DEMO_STORE_PASSWORD,
        envPassword: process.env.WASSL_DEMO_STORE_PASSWORD,
      },
      {
        email: "sahara@wassl.ma",
        password: DEMO_STORE_PASSWORD,
        envPassword: process.env.WASSL_DEMO_STORE_PASSWORD,
      },
      {
        email: "laayoune@wassl.ma",
        password: DEMO_STORE_PASSWORD,
        envPassword: process.env.WASSL_DEMO_STORE_PASSWORD,
      },
      {
        email: DEMO_DRIVER_EMAIL,
        password: DEMO_DRIVER_PASSWORD,
        envPassword: process.env.WASSL_DEMO_DRIVER_PASSWORD,
      },
      {
        email: "driver2@wassl.ma",
        password: DEMO_DRIVER_PASSWORD,
        envPassword: process.env.WASSL_DEMO_DRIVER_PASSWORD,
      },
      {
        email: DEMO_CUSTOMER_EMAIL,
        password: DEMO_CUSTOMER_PASSWORD,
        envPassword: process.env.WASSL_DEMO_CUSTOMER_PASSWORD,
      },
    ];
    for (const demo of demoCredentials) {
      const account = db.users.find(
        (user) => user.email.toLowerCase() === demo.email,
      );
      if (!account) {
        // Older databases predate the customer demo account.
        if (demo.email === DEMO_CUSTOMER_EMAIL) {
          db.users.push({
            id: "user_customer_demo",
            email: demo.email,
            passwordHash: hashPassword(demo.password),
            name: "Mariam K.",
            role: "customer",
            phone: "+212 662 10 20 30",
            citySlug: "dakhla",
            accountStatus: "active",
            createdAt: new Date().toISOString(),
          });
        }
        continue;
      }
      if (
        !account.passwordHash ||
        (demo.envPassword &&
          !verifyPassword(demo.password, account.passwordHash))
      ) {
        account.passwordHash = hashPassword(demo.password);
      }
      if (account.storeId || account.driverId) {
        account.accountStatus = "active";
      }
    }

    return operator;
  });
}

/**
 * Create the account on first sign-in, or refresh the profile on later ones.
 * Existing demo staff keep their store/driver bindings; new OTP accounts get a
 * fresh id and the requested role.
 */
export async function upsertOtpUser(input: {
  email: string;
  name?: string;
  role?: Role;
}): Promise<User> {
  return mutate((db) => {
    const email = input.email.trim().toLowerCase();
    const existing = db.users.find(
      (user) => user.email.toLowerCase() === email,
    );

    if (existing) {
      if (input.name && input.name.trim() && input.name.trim() !== existing.name) {
        existing.name = input.name.trim();
      }
      return existing;
    }

    const role = input.role ?? "merchant";
    const created: User = {
      id: randomId("user", 8),
      email,
      // OTP accounts never use passwords; the hash column stays empty.
      passwordHash: "",
      name: input.name?.trim() || email.split("@")[0],
      role,
      accountStatus:
        role === "merchant" || role === "driver" ? "pending" : "active",
      createdAt: new Date().toISOString(),
    };
    db.users.push(created);
    return created;
  });
}

/** Safe projection of an account for the admin console (no password hash). */
export type AdminUserView = Omit<User, "passwordHash">;

function publicUser(user: User): AdminUserView {
  const { passwordHash: _passwordHash, ...rest } = user;
  return { ...rest, accountStatus: effectiveAccountStatus(user) };
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42) || "store";
}

export async function getUsers(): Promise<AdminUserView[]> {
  return (await getDb()).users.map(publicUser);
}

/**
 * Attach a role, store or driver profile to an account. This is how operations
 * approves a self-service sign-up. A store implies a merchant account and a
 * driver profile implies a driver account.
 */
export async function updateUserAccess(input: {
  userId: string;
  role?: Role;
  storeId?: string | null;
  driverId?: string | null;
  actor?: { id: string; name: string; role: Role };
}): Promise<AdminUserView> {
  return mutate((db) => {
    const user = db.users.find((candidate) => candidate.id === input.userId);
    if (!user) throw new Error("Account not found");
    const before = `${user.role}${user.storeId ? ` · ${user.storeId}` : ""}${
      user.driverId ? ` · ${user.driverId}` : ""
    }`;

    if (input.storeId !== undefined) {
      if (input.storeId) {
        const store = db.stores.find((candidate) => candidate.id === input.storeId);
        if (!store) throw new Error("Store not found");
        user.storeId = store.id;
        user.role = "merchant";
        delete user.driverId;
      } else {
        delete user.storeId;
      }
    }

    if (input.driverId !== undefined) {
      if (input.driverId) {
        const driver = db.drivers.find((candidate) => candidate.id === input.driverId);
        if (!driver) throw new Error("Driver not found");
        user.driverId = driver.id;
        user.role = "driver";
        delete user.storeId;
      } else {
        delete user.driverId;
      }
    }

    if (input.role) {
      user.role = input.role;
      if (input.role === "admin" || input.role === "customer") {
        delete user.storeId;
        delete user.driverId;
        user.accountStatus = "active";
      }
      if (input.role === "merchant") delete user.driverId;
      if (input.role === "driver") delete user.storeId;
    }

    if (user.role === "admin" || user.role === "customer") {
      user.accountStatus = "active";
    } else if (
      (user.role === "merchant" && user.storeId) ||
      (user.role === "driver" && user.driverId)
    ) {
      user.accountStatus = "active";
    } else {
      user.accountStatus = "pending";
    }

    const after = `${user.role}${user.storeId ? ` · ${user.storeId}` : ""}${
      user.driverId ? ` · ${user.driverId}` : ""
    }`;
    recordAudit(db, {
      action: "auth.access_update",
      entity: "auth",
      entityId: user.id,
      summary: `Access updated for ${user.email}`,
      before,
      after,
      actorRole: input.actor?.role ?? "system",
      actorId: input.actor?.id,
      actorName: input.actor?.name,
    });

    return publicUser(user);
  });
}

/**
 * One-click approval. A store owner gets a storefront provisioned from their
 * sign-up details; a driver gets a courier profile. Both can be edited later
 * from the admin console.
 */
export async function approveUser(input: {
  userId: string;
  storeId?: string;
  driverId?: string;
  actor?: { id: string; name: string; role: Role };
}): Promise<AdminUserView> {
  return mutate((db) => {
    const user = db.users.find((candidate) => candidate.id === input.userId);
    if (!user) throw new Error("Account not found");

    if (input.storeId && user.role === "merchant") {
      if (!db.stores.some((store) => store.id === input.storeId)) {
        throw new Error("Store not found");
      }
      user.storeId = input.storeId;
      delete user.driverId;
    }

    if (input.driverId && user.role === "driver") {
      if (!db.drivers.some((driver) => driver.id === input.driverId)) {
        throw new Error("Driver profile not found");
      }
      user.driverId = input.driverId;
      delete user.storeId;
    }

    const city =
      db.cities.find((candidate) => candidate.slug === user.citySlug) ||
      db.cities.find((candidate) => candidate.slug === "dakhla") ||
      db.cities[0];

    if (user.role === "merchant" && !user.storeId) {
      const baseName = user.requestedStoreName?.trim() || `${user.name}'s store`;
      let slug = slugify(baseName);
      if (db.stores.some((store) => store.slug === slug)) {
        slug = `${slug}-${randomId("x", 3).slice(-6)}`;
      }
      const store: Store = {
        id: `store_${slug}`,
        slug,
        name: baseName,
        nameAr: "",
        citySlug: city?.slug || "dakhla",
        category: "restaurant",
        tagline: "New partner on Wassl",
        description:
          "Approved partner store. The operator will publish the menu and confirm delivery details.",
        address: `${city?.name || "Dakhla"} — address to confirm`,
        landmark: city?.name || "Dakhla",
        lat: city?.lat ?? 23.6848,
        lng: city?.lng ?? -15.958,
        accent: "#0f6e6e",
        rating: 0,
        reviews: 0,
        prepTime: 30,
        minOrder: 30,
        deliveryFee: db.settings.defaultDeliveryFee,
        isOpen: false,
        commissionRate: db.settings.commissionRate,
        phone: user.phone || db.settings.supportPhone,
        ownerName: user.name,
        dataOrigin: "wassl",
        tags: ["New"],
        verifiedAt: new Date().toISOString(),
      };
      db.stores.push(store);
      user.storeId = store.id;
      delete user.driverId;
    }

    if (user.role === "driver" && !user.driverId) {
      const driver: Driver = {
        id: `driver_${randomId("x", 4).slice(2)}`,
        name: user.name,
        phone: user.phone || "",
        email: user.email,
        citySlug: city?.slug || "dakhla",
        vehicle: user.requestedVehicle || "Motorbike",
        plate: "",
        status: "offline",
        lat: city?.lat ?? 23.6848,
        lng: city?.lng ?? -15.958,
        rating: 5,
        deliveries: 0,
        cashOnHand: 0,
        cashLimit: 1000,
        active: true,
      };
      db.drivers.push(driver);
      user.driverId = driver.id;
      delete user.storeId;
    }

    user.accountStatus =
      user.role === "admin" ||
      user.role === "customer" ||
      (user.role === "merchant" && user.storeId) ||
      (user.role === "driver" && user.driverId)
        ? "active"
        : "pending";

    recordAudit(db, {
      action: "auth.approve",
      entity: "auth",
      entityId: user.id,
      summary: `Approved ${user.email} as ${user.role}`,
      after: `${user.role}${user.storeId ? ` · ${user.storeId}` : ""}${
        user.driverId ? ` · ${user.driverId}` : ""
      }`,
      actorRole: input.actor?.role ?? "system",
      actorId: input.actor?.id,
      actorName: input.actor?.name,
    });
    return publicUser(user);
  });
}

export async function rejectUser(input: {
  userId: string;
  actor?: { id: string; name: string; role: Role };
}): Promise<AdminUserView> {
  return mutate((db) => {
    const user = db.users.find((candidate) => candidate.id === input.userId);
    if (!user) throw new Error("Account not found");
    if (user.role === "admin") {
      throw new Error("Operator accounts cannot be rejected");
    }
    user.accountStatus = "rejected";
    recordAudit(db, {
      action: "auth.reject",
      entity: "auth",
      entityId: user.id,
      summary: `Rejected access for ${user.email}`,
      after: "rejected",
      actorRole: input.actor?.role ?? "system",
      actorId: input.actor?.id,
      actorName: input.actor?.name,
    });
    return publicUser(user);
  });
}


function citiesFromDb(db: Database): City[] {
  return [...db.cities].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority ? -1 : 1;
    return (b.population || 0) - (a.population || 0);
  });
}

function storeFromDb(db: Database, slugOrId: string): Store | undefined {
  const store = db.stores.find(
    (entry) => entry.slug === slugOrId || entry.id === slugOrId,
  );
  if (!store) return undefined;
  const dietary = new Set<string>(DIETARY_TAGS);
  const tags = new Set(
    db.products
      .filter((product) => product.storeId === store.id)
      .flatMap((product) => product.tags ?? [])
      .filter((tag) => dietary.has(tag)),
  );
  return { ...store, dietaryTags: [...tags].sort() };
}

function storesFromDb(db: Database, citySlug?: string): Store[] {
  const dietary = new Set<string>(DIETARY_TAGS);
  const tagsByStore = new Map<string, Set<string>>();
  for (const product of db.products) {
    for (const tag of product.tags ?? []) {
      if (!dietary.has(tag)) continue;
      const tags = tagsByStore.get(product.storeId) ?? new Set<string>();
      tags.add(tag);
      tagsByStore.set(product.storeId, tags);
    }
  }
  return [...db.stores]
    .filter((store) => (citySlug ? store.citySlug === citySlug : true))
    .map((store) => ({
      ...store,
      dietaryTags: [...(tagsByStore.get(store.id) ?? [])].sort(),
    }))
    .sort(
      (a, b) => Number(b.isOpen) - Number(a.isOpen) || b.rating - a.rating,
    );
}

export async function getCities(): Promise<City[]> {
  return citiesFromDb(await getDb());
}

export async function getPriorityCities(): Promise<City[]> {
  return (await getCities()).filter((city) => city.priority);
}

export async function getCity(slug: string): Promise<City | undefined> {
  return (await getDb()).cities.find((city) => city.slug === slug);
}

export async function getStores(citySlug?: string): Promise<Store[]> {
  return storesFromDb(await getDb(), citySlug);
}

export async function getStore(slugOrId: string): Promise<Store | undefined> {
  return storeFromDb(await getDb(), slugOrId);
}

export async function getProducts(storeId: string): Promise<Product[]> {
  return (await getDb()).products.filter((product) => product.storeId === storeId);
}

export async function getDrivers(citySlug?: string): Promise<Driver[]> {
  const drivers = (await getDb()).drivers;
  return citySlug
    ? drivers.filter((driver) => driver.citySlug === citySlug)
    : drivers;
}

export async function getDriver(id: string): Promise<Driver | undefined> {
  return (await getDb()).drivers.find((driver) => driver.id === id);
}

const ADDRESS_LIMIT = 10;

function validAddressToken(token: string) {
  const value = token.trim();
  return value.length >= 16 && value.length <= 128 ? value : null;
}

/** Guest address book, scoped to the random token kept in the browser. */
export async function getAddresses(token: string): Promise<CustomerAddress[]> {
  const value = validAddressToken(token);
  if (!value) return [];
  return (await getDb())
    .addresses.filter((entry) => entry.token === value)
    .sort(
      (a, b) =>
        new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime(),
    )
    .slice(0, ADDRESS_LIMIT);
}

export async function saveAddress(input: {
  token: string;
  label?: string;
  name: string;
  phone: string;
  address: string;
  landmark: string;
  lat: number;
  lng: number;
}): Promise<CustomerAddress> {
  const token = validAddressToken(input.token);
  if (!token) throw new Error("Invalid address book");
  const name = input.name.trim();
  const phone = input.phone.trim();
  const address = input.address.trim();
  const landmark = input.landmark.trim();
  if (!name || !phone || !address || !landmark) {
    throw new Error("Name, phone, address and landmark are required");
  }
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) {
    throw new Error("A map pin is required");
  }

  return mutate((db) => {
    const now = new Date().toISOString();
    const existing = db.addresses.find(
      (entry) =>
        entry.token === token &&
        entry.address.toLowerCase() === address.toLowerCase() &&
        entry.landmark.toLowerCase() === landmark.toLowerCase(),
    );
    if (existing) {
      existing.name = name;
      existing.phone = phone;
      existing.label = input.label?.trim() || existing.label;
      existing.lat = input.lat;
      existing.lng = input.lng;
      existing.lastUsedAt = now;
      return existing;
    }

    const entry: CustomerAddress = {
      id: randomId("addr", 5),
      token,
      label: input.label?.trim() || "Home",
      name,
      phone,
      address,
      landmark,
      lat: input.lat,
      lng: input.lng,
      createdAt: now,
      lastUsedAt: now,
    };
    db.addresses.unshift(entry);

    const own = db.addresses
      .filter((item) => item.token === token)
      .sort(
        (a, b) =>
          new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime(),
      );
    if (own.length > ADDRESS_LIMIT) {
      const keep = new Set(own.slice(0, ADDRESS_LIMIT).map((item) => item.id));
      db.addresses = db.addresses.filter(
        (item) => item.token !== token || keep.has(item.id),
      );
    }
    return entry;
  });
}

export async function deleteAddress(token: string, id: string): Promise<boolean> {
  const value = validAddressToken(token);
  if (!value) return false;
  return mutate((db) => {
    const before = db.addresses.length;
    db.addresses = db.addresses.filter(
      (entry) => !(entry.token === value && entry.id === id),
    );
    return db.addresses.length < before;
  });
}

function ordersFromDb(
  db: Database,
  filter?: {
    citySlug?: string;
    storeId?: string;
    driverId?: string;
    customerEmail?: string;
    status?: OrderStatus;
    ids?: string[];
  },
): Order[] {
  const ids = filter?.ids ? new Set(filter.ids) : null;
  return db.orders
    .filter((order) => {
      if (ids && !ids.has(order.id) && !ids.has(order.code)) return false;
      if (filter?.citySlug && order.citySlug !== filter.citySlug) return false;
      if (filter?.storeId && order.storeId !== filter.storeId) return false;
      if (filter?.driverId && order.driverId !== filter.driverId) return false;
      if (
        filter?.customerEmail &&
        order.customerEmail?.toLowerCase() !== filter.customerEmail.toLowerCase()
      ) {
        return false;
      }
      if (filter?.status && order.status !== filter.status) return false;
      return true;
    })
    .sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
}

function findOrder(db: Database, idOrCode: string): Order | undefined {
  return db.orders.find(
    (order) =>
      order.id === idOrCode ||
      order.code.toLowerCase() === idOrCode.toLowerCase(),
  );
}

export type OrderView = Order & {
  store?: Store;
  driver?: Driver;
  city?: City;
};

function orderViewFromDb(db: Database, order: Order): OrderView {
  return {
    ...order,
    store: storeFromDb(db, order.storeId),
    driver: order.driverId
      ? db.drivers.find((driver) => driver.id === order.driverId)
      : undefined,
    city: db.cities.find((city) => city.slug === order.citySlug),
  };
}

export async function getOrders(filter?: {
  citySlug?: string;
  storeId?: string;
  driverId?: string;
  customerEmail?: string;
  status?: OrderStatus;
  ids?: string[];
}): Promise<Order[]> {
  return ordersFromDb(await getDb(), filter);
}

export async function getOrderViews(filter?: {
  citySlug?: string;
  storeId?: string;
  driverId?: string;
  customerEmail?: string;
  status?: OrderStatus;
  ids?: string[];
}): Promise<OrderView[]> {
  const db = await getDb();
  return ordersFromDb(db, filter).map((order) => orderViewFromDb(db, order));
}

export type DriverBoard = {
  driver: Driver;
  orders: OrderView[];
  cityOrders: OrderView[];
};

/**
 * A driver's route plus the live city queue. Unassigned queue items are
 * deliberately stripped of customer PII: a driver only receives the address
 * and phone after the order is assigned (or claimed) to them.
 */
function driverQueueViewFromDb(db: Database, order: Order): OrderView {
  const view = orderViewFromDb(db, order);
  return {
    ...view,
    customerName: "Customer",
    customerPhone: "",
    customerEmail: undefined,
    address: view.store?.address ?? "Store pickup",
    landmark: "",
    notes: undefined,
    lat: view.store?.lat ?? view.lat,
    lng: view.store?.lng ?? view.lng,
    events: [],
  };
}

export async function getDriverBoard(
  driverId: string,
): Promise<DriverBoard | undefined> {
  const db = await getDb();
  const driver = db.drivers.find((item) => item.id === driverId);
  if (!driver) return undefined;
  return {
    driver,
    orders: ordersFromDb(db, { driverId }).map((order) =>
      orderViewFromDb(db, order),
    ),
    cityOrders: ordersFromDb(db, { citySlug: driver.citySlug })
      .filter(
        (order) =>
          !order.driverId &&
          !["delivered", "cancelled"].includes(order.status),
      )
      .map((order) => driverQueueViewFromDb(db, order)),
  };
}

export async function getOrder(idOrCode: string): Promise<Order | undefined> {
  return findOrder(await getDb(), idOrCode);
}

export async function getOrderView(
  idOrCode: string,
): Promise<OrderView | undefined> {
  const db = await getDb();
  const order = findOrder(db, idOrCode);
  return order ? orderViewFromDb(db, order) : undefined;
}

function pushEvent(order: Order, type: string, label: string, note?: string) {
  const entry: OrderEvent = {
    id: randomId("evt", 5),
    type,
    label,
    at: new Date().toISOString(),
    note,
  };
  order.events.push(entry);
  order.updatedAt = entry.at;
}

export async function createOrder(
  input: {
    citySlug: string;
    storeId: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    address: string;
    landmark: string;
    notes?: string;
    lat: number;
    lng: number;
    items: { productId: string; qty: number; optionIds?: string[] }[];
    scheduledFor?: string;
    promoCode?: string;
  },
  actor: OrderActor = { role: "customer" },
): Promise<Order> {
  return mutate((db) => {
    const store = db.stores.find((item) => item.id === input.storeId);
    if (!store) throw new Error("Store not found");
    if (!store.isOpen) throw new Error("Store is currently closed");
    if (store.citySlug !== input.citySlug) throw new Error("Store is not in this city");

    const items = input.items
      .map((line) => {
        const product = db.products.find(
          (item) => item.id === line.productId && item.storeId === store.id,
        );
        if (!product || !product.available) return null;
        const qty = Math.max(1, Math.min(20, Math.floor(line.qty)));

        const requested = line.optionIds ?? [];
        const selected: NonNullable<Order["items"][number]["options"]> = [];
        let unitPrice = product.price;

        for (const group of product.modifiers ?? []) {
          const ids = requested.filter((id) =>
            group.options.some((option) => option.id === id),
          );
          if (ids.length < group.min || ids.length > group.max) {
            throw new Error(
              `Choose ${group.min === group.max ? group.min : `${group.min}–${group.max}`} option(s) for ${group.name}`,
            );
          }
          for (const id of ids) {
            const option = group.options.find((item) => item.id === id)!;
            unitPrice += option.priceDelta;
            selected.push({
              groupId: group.id,
              groupName: group.name,
              optionId: option.id,
              optionName: option.name,
              priceDelta: option.priceDelta,
            });
          }
        }

        const knownOptions = new Set(
          (product.modifiers ?? []).flatMap((group) => group.options.map((option) => option.id)),
        );
        if (requested.some((id) => !knownOptions.has(id))) {
          throw new Error(`Unknown option for ${product.name}`);
        }

        return {
          productId: product.id,
          name: product.name,
          emoji: product.emoji,
          price: unitPrice,
          qty,
          options: selected.length ? selected : undefined,
        };
      })
      .filter((line): line is NonNullable<typeof line> => Boolean(line));

    if (items.length === 0) throw new Error("Cart is empty");

    const subtotal = items.reduce((sum, line) => sum + line.price * line.qty, 0);
    if (subtotal < store.minOrder) {
      throw new Error(`Minimum order is ${store.minOrder} MAD`);
    }

    const promo = input.promoCode
      ? quotePromo(input.promoCode, {
          subtotal,
          deliveryFee: store.deliveryFee,
          citySlug: store.citySlug,
        })
      : null;
    if (promo && !promo.ok) throw new Error(promo.error);

    const deliveryFee =
      promo?.ok && promo.quote.freeDelivery ? 0 : store.deliveryFee;
    const discount = promo?.ok ? promo.quote.discount : 0;
    const total = Math.max(0, subtotal + deliveryFee - discount);

    const now = new Date().toISOString();
    const order: Order = {
      id: randomId("order", 6),
      code: orderCode(),
      citySlug: input.citySlug,
      storeId: store.id,
      status: "placed",
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      address: input.address,
      landmark: input.landmark,
      notes: input.notes,
      lat: input.lat,
      lng: input.lng,
      items,
      subtotal,
      deliveryFee,
      total,
      promoCode: promo?.ok ? promo.quote.code : undefined,
      discount: discount || undefined,
      paymentMethod: "cod",
      scheduledFor: input.scheduledFor,
      createdAt: now,
      updatedAt: now,
      events: [
        {
          id: randomId("evt", 5),
          type: "placed",
          label: "Order placed — cash on delivery",
          at: now,
        },
      ],
    };

    db.orders.unshift(order);
    recordAudit(db, {
      actorRole: actor.role,
      actorId: actor.id,
      actorName: input.customerName,
      action: "order.create",
      entity: "order",
      entityId: order.id,
      summary: `Order ${order.code} placed at ${store.name} — ${order.items.length} line(s), ${order.total} MAD cash on delivery`,
      after: "placed",
    });
    publish({
      type: "order",
      orderId: order.id,
      storeId: store.id,
      citySlug: order.citySlug,
      status: order.status,
    });
    void getOrderView(order.id).then(
      (view) => view && notifyOrderStatusChange(view, order.customerEmail),
    );
    return order;
  });
}

export async function updateOrderStatus(
  orderId: string,
  next: OrderStatus,
  actor: OrderActor,
  options: { note?: string } = {},
): Promise<Order> {
  return mutate((db) => {
    const order = db.orders.find(
      (item) => item.id === orderId || item.code.toLowerCase() === orderId.toLowerCase(),
    );
    if (!order) throw new OrderRuleError("not_found", "Order not found");

    const check = checkTransition(order, next, actor, options);
    if (!check.ok) throw new OrderRuleError(check.code, check.error);

    const now = new Date().toISOString();
    const from = order.status;

    if (next === "assigned") {
      if (!order.driverId) throw new OrderRuleError("driver_required", "Assign a driver first");
      order.assignedAt = now;
      const driver = db.drivers.find((d) => d.id === order.driverId);
      if (driver) driver.status = "busy";
    }
    if (next === "accepted") order.acceptedAt = now;
    if (next === "ready") {
      order.readyAt = now;
      if (from === "assigned") {
        order.driverId = undefined;
        order.assignedAt = undefined;
      }
    }
    if (next === "picked_up") order.pickedUpAt = now;
    if (next === "delivered") {
      order.deliveredAt = now;
      order.cashCollected = true;
      const driver = db.drivers.find((d) => d.id === order.driverId);
      if (driver) {
        driver.cashOnHand += order.total;
        driver.deliveries += 1;
        driver.status = "available";
      }
    }
    if (next === "cancelled") {
      order.cancelledAt = now;
      order.cancellationReason = options.note?.trim() || undefined;
      const driver = db.drivers.find((d) => d.id === order.driverId);
      if (driver && driver.status === "busy") driver.status = "available";
    }

    order.status = next;
    order.updatedAt = now;

    const labels: Record<OrderStatus, string> = {
      placed: "Order placed",
      accepted: "Store accepted",
      preparing: "Preparing your order",
      ready: "Ready for pickup",
      assigned: "Driver assigned",
      picked_up: "Picked up from store",
      en_route: "On the way to you",
      delivered: "Delivered — cash collected",
      cancelled: "Order cancelled",
    };
    pushEvent(order, next, labels[next], options.note);

    recordAudit(db, {
      actorRole: actor.role,
      actorId: actor.id,
      actorName: actor.name,
      action: `order.${check.rule.action}`,
      entity: "order",
      entityId: order.id,
      summary: `${order.code}: ${STATUS_META[from].label} → ${STATUS_META[next].label}`,
      before: from,
      after: next,
      note: options.note,
      metadata: { storeId: order.storeId, driverId: order.driverId },
    });

    publish({
      type: "order",
      orderId: order.id,
      storeId: order.storeId,
      citySlug: order.citySlug,
      driverId: order.driverId,
      status: next,
    });
    return order;
  });
}

function assignDriverInDb(
  db: Database,
  order: Order,
  driver: Driver,
  actor: OrderActor,
): Order {
  if (order.driverId) {
    throw new OrderRuleError(
      "already_assigned",
      "Unassign the current driver before choosing another one",
    );
  }
  if (actor.role === "driver" && actor.driverId !== driver.id) {
    throw new OrderRuleError(
      "wrong_driver",
      "Drivers can only accept an order for themselves",
    );
  }
  if (!driver.active) throw new OrderRuleError("driver_inactive", "Driver is not active");
  if (driver.citySlug !== order.citySlug) {
    throw new OrderRuleError("wrong_city", "Driver is in another city");
  }
  if (driver.status === "offline") {
    throw new OrderRuleError("driver_offline", "Driver is offline");
  }
  if (driver.status === "busy") {
    throw new OrderRuleError("driver_busy", "Driver is already on a delivery");
  }
  if (driver.cashOnHand >= driver.cashLimit) {
    throw new OrderRuleError("cash_limit", "Driver has reached the cash limit");
  }
  const hasActiveDelivery = db.orders.some(
    (entry) =>
      entry.driverId === driver.id &&
      ["assigned", "picked_up", "en_route"].includes(entry.status),
  );
  if (hasActiveDelivery) {
    throw new OrderRuleError("driver_busy", "Driver already has an active delivery");
  }

  const check = checkTransition(order, "assigned", actor);
  if (!check.ok) throw new OrderRuleError(check.code, check.error);

  order.driverId = driver.id;
  order.status = "assigned";
  order.assignedAt = new Date().toISOString();
  order.updatedAt = order.assignedAt;
  driver.status = "busy";
  pushEvent(order, "assigned", `${driver.name} assigned to this order`);

  recordAudit(db, {
    actorRole: actor.role,
    actorId: actor.id,
    actorName: actor.name,
    action: "order.assign_driver",
    entity: "order",
    entityId: order.id,
    summary: `${order.code}: ${STATUS_META.ready.label} → ${STATUS_META.assigned.label} (${driver.name})`,
    before: "ready",
    after: "assigned",
    metadata: { storeId: order.storeId, driverId: driver.id },
  });

  publish({
    type: "order",
    orderId: order.id,
    storeId: order.storeId,
    citySlug: order.citySlug,
    driverId: driver.id,
    status: order.status,
  });
  publish({ type: "driver", driverId: driver.id, citySlug: driver.citySlug });
  return order;
}

export async function assignDriver(
  orderId: string,
  driverId: string,
  actor: OrderActor,
): Promise<Order> {
  return mutate((db) => {
    const order = findOrder(db, orderId);
    const driver = db.drivers.find((item) => item.id === driverId);
    if (!order) throw new OrderRuleError("not_found", "Order not found");
    if (!driver) throw new OrderRuleError("not_found", "Driver not found");
    return assignDriverInDb(db, order, driver, actor);
  });
}

export async function autoAssignOrder(
  orderId: string,
  actor: OrderActor,
): Promise<Order> {
  return mutate((db) => {
    const order = findOrder(db, orderId);
    if (!order) throw new OrderRuleError("not_found", "Order not found");
    if (order.driverId) {
      throw new OrderRuleError("already_assigned", "This order already has a driver");
    }
    const candidates = db.drivers
      .filter(
        (driver) =>
          driver.citySlug === order.citySlug &&
          driver.active &&
          driver.status === "available" &&
          driver.cashOnHand < driver.cashLimit,
      )
      .map((driver) => ({
        driver,
        distance: Math.hypot(driver.lat - order.lat, driver.lng - order.lng),
      }))
      .sort((a, b) => a.distance - b.distance);

    if (!candidates.length) {
      throw new OrderRuleError("no_driver", "No available driver in this city");
    }
    return assignDriverInDb(db, order, candidates[0].driver, actor);
  });
}

export async function updateDriverLocation(
  driverId: string,
  lat: number,
  lng: number,
): Promise<Driver> {
  return mutate((db) => {
    const driver = db.drivers.find((item) => item.id === driverId);
    if (!driver) throw new Error("Driver not found");
    driver.lat = lat;
    driver.lng = lng;
    const activeOrder = db.orders.find(
      (order) =>
        order.driverId === driverId &&
        ["assigned", "picked_up", "en_route"].includes(order.status),
    );
    publish({
      type: "location",
      driverId,
      citySlug: driver.citySlug,
      // This lets the customer tracking page refresh immediately as the
      // driver moves, without exposing the driver feed to other customers.
      orderId: activeOrder?.id,
    });
    return driver;
  });
}

export async function setDriverStatus(
  driverId: string,
  status: Driver["status"],
  actor: OrderActor,
): Promise<Driver> {
  return mutate((db) => {
    const driver = db.drivers.find((item) => item.id === driverId);
    if (!driver) throw new Error("Driver not found");
    const activeOrder = db.orders.find(
      (order) =>
        order.driverId === driverId &&
        ["assigned", "picked_up", "en_route"].includes(order.status),
    );
    if (activeOrder && status !== "busy") {
      throw new OrderRuleError(
        "active_delivery",
        "Finish the active delivery before changing your status",
      );
    }
    const before = driver.status;
    driver.status = status;
    recordAudit(db, {
      actorRole: actor.role,
      actorId: actor.id,
      actorName: actor.name,
      action: "driver.status",
      entity: "driver",
      entityId: driverId,
      summary: `${driver.name}: ${before} → ${status}`,
      before,
      after: status,
    });
    publish({ type: "driver", driverId, citySlug: driver.citySlug });
    return driver;
  });
}

const STORE_CATEGORIES = ["restaurant", "grocery", "pharmacy", "cafe", "gifts"] as const;

export type CreateStoreInput = {
  name: string;
  nameAr?: string;
  citySlug: string;
  category: Store["category"];
  tagline?: string;
  description?: string;
  address?: string;
  landmark?: string;
  lat?: number;
  lng?: number;
  prepTime?: number;
  minOrder?: number;
  deliveryFee?: number;
  commissionRate?: number;
  phone?: string;
  ownerName?: string;
  isOpen?: boolean;
  accent?: string;
  tags?: string[];
};

/**
 * Operator-created partner store. Imported/locked directory records are never
 * touched here; this only appends a Wassl-owned storefront.
 */
export async function createStore(
  input: CreateStoreInput,
  actor: OrderActor,
): Promise<Store> {
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Store name is required");
  if (!STORE_CATEGORIES.includes(input.category)) {
    throw new Error("Choose a valid store category");
  }

  return mutate((db) => {
    const city = db.cities.find((candidate) => candidate.slug === input.citySlug);
    if (!city) throw new Error("City not found");

    let slug = slugify(name);
    if (db.stores.some((store) => store.slug === slug)) {
      slug = `${slug}-${randomId("x", 3).slice(-6)}`;
    }

    const store: Store = {
      id: `store_${slug}`,
      slug,
      name,
      nameAr: input.nameAr?.trim() ?? "",
      citySlug: city.slug,
      category: input.category,
      tagline: input.tagline?.trim() || "New partner on Wassl",
      description:
        input.description?.trim() ||
        "Local partner store. The operator will publish the menu and confirm delivery details.",
      address: input.address?.trim() || `${city.name} — address to confirm`,
      landmark: input.landmark?.trim() || city.name,
      lat:
        typeof input.lat === "number" && Number.isFinite(input.lat) ? input.lat : city.lat,
      lng:
        typeof input.lng === "number" && Number.isFinite(input.lng) ? input.lng : city.lng,
      accent: input.accent || "#0f6e6e",
      rating: 0,
      reviews: 0,
      prepTime: Math.max(5, Math.min(180, Math.round(input.prepTime ?? 30))),
      minOrder: Math.max(0, Math.round(input.minOrder ?? 30)),
      deliveryFee: Math.max(0, Math.round(input.deliveryFee ?? db.settings.defaultDeliveryFee)),
      isOpen: input.isOpen ?? false,
      commissionRate: Math.max(
        0,
        Math.min(40, input.commissionRate ?? db.settings.commissionRate),
      ),
      phone: input.phone?.trim() || db.settings.supportPhone,
      ownerName: input.ownerName?.trim() || "Wassl partner",
      dataOrigin: "wassl",
      tags: input.tags?.length ? input.tags : ["New"],
      verifiedAt: new Date().toISOString(),
    };
    db.stores.push(store);
    recordAudit(db, {
      actorRole: actor.role,
      actorId: actor.id,
      actorName: actor.name,
      action: "store.create",
      entity: "store",
      entityId: store.id,
      summary: `Created store ${store.name} in ${city.name}`,
      after: `${store.category} · ${store.citySlug}`,
    });
    publish({ type: "store", storeId: store.id, citySlug: store.citySlug });
    return store;
  });
}

export async function updateStoreAdmin(
  storeId: string,
  patch: Partial<
    Pick<
      Store,
      | "name"
      | "nameAr"
      | "citySlug"
      | "category"
      | "tagline"
      | "description"
      | "address"
      | "landmark"
      | "lat"
      | "lng"
      | "prepTime"
      | "minOrder"
      | "deliveryFee"
      | "commissionRate"
      | "phone"
      | "ownerName"
      | "isOpen"
    >
  >,
  actor: OrderActor,
): Promise<Store> {
  return mutate((db) => {
    const store = db.stores.find((item) => item.id === storeId);
    if (!store) throw new Error("Store not found");
    if (store.locked) throw new Error("Locked directory stores cannot be edited");

    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (name.length < 2) throw new Error("Store name is required");
      patch.name = name;
    }
    if (patch.citySlug !== undefined) {
      if (!db.cities.some((city) => city.slug === patch.citySlug)) {
        throw new Error("City not found");
      }
    }
    if (patch.category !== undefined && !STORE_CATEGORIES.includes(patch.category)) {
      throw new Error("Choose a valid store category");
    }

    const before = `${store.name} · ${store.citySlug} · fee ${store.deliveryFee}`;
    Object.assign(store, patch);
    recordAudit(db, {
      actorRole: actor.role,
      actorId: actor.id,
      actorName: actor.name,
      action: "store.update",
      entity: "store",
      entityId: storeId,
      summary: `Updated store ${store.name}`,
      before,
      after: `${store.name} · ${store.citySlug} · fee ${store.deliveryFee}`,
    });
    publish({ type: "store", storeId, citySlug: store.citySlug });
    return store;
  });
}

export async function updateDriverAdmin(
  driverId: string,
  patch: {
    active?: boolean;
    vehicle?: string;
    plate?: string;
    phone?: string;
    cashLimit?: number;
    resetCash?: boolean;
    status?: Driver["status"];
  },
  actor: OrderActor,
): Promise<Driver> {
  return mutate((db) => {
    const driver = db.drivers.find((item) => item.id === driverId);
    if (!driver) throw new Error("Driver not found");

    const activeOrder = db.orders.find(
      (order) =>
        order.driverId === driverId &&
        ["assigned", "picked_up", "en_route"].includes(order.status),
    );
    if (patch.active === false && activeOrder) {
      throw new Error("Finish the active delivery before deactivating this driver");
    }
    if (patch.status && patch.status !== "busy" && activeOrder) {
      throw new Error("Finish the active delivery before changing the driver status");
    }
    if (patch.cashLimit !== undefined) {
      if (!Number.isFinite(patch.cashLimit) || patch.cashLimit < 0) {
        throw new Error("Cash limit must be zero or more");
      }
      driver.cashLimit = Math.round(patch.cashLimit);
    }

    const before = `${driver.vehicle} · ${driver.plate || "no plate"} · ${
      driver.active ? "active" : "inactive"
    } · cash ${driver.cashOnHand}`;
    if (patch.vehicle !== undefined) driver.vehicle = patch.vehicle.trim() || driver.vehicle;
    if (patch.plate !== undefined) driver.plate = patch.plate.trim();
    if (patch.phone !== undefined) driver.phone = patch.phone.trim();
    if (patch.active !== undefined) {
      driver.active = patch.active;
      if (!patch.active) driver.status = "offline";
    }
    if (patch.status) driver.status = patch.status;
    if (patch.resetCash) driver.cashOnHand = 0;

    recordAudit(db, {
      actorRole: actor.role,
      actorId: actor.id,
      actorName: actor.name,
      action: "driver.update",
      entity: "driver",
      entityId: driverId,
      summary: `Updated driver ${driver.name}`,
      before,
      after: `${driver.vehicle} · ${driver.plate || "no plate"} · ${
        driver.active ? "active" : "inactive"
      } · cash ${driver.cashOnHand}`,
    });
    publish({ type: "driver", driverId, citySlug: driver.citySlug });
    return driver;
  });
}

export async function updateStore(
  storeId: string,
  patch: Partial<Pick<Store, "isOpen">>,
  actor: OrderActor,
): Promise<Store> {
  return mutate((db) => {
    const store = db.stores.find((item) => item.id === storeId);
    if (!store) throw new Error("Store not found");
    const before = store.isOpen;
    Object.assign(store, patch);
    recordAudit(db, {
      actorRole: actor.role,
      actorId: actor.id,
      actorName: actor.name,
      action: "store.update",
      entity: "store",
      entityId: storeId,
      summary: `${store.name} is now ${store.isOpen ? "open" : "closed"}`,
      before: String(before),
      after: String(store.isOpen),
    });
    publish({ type: "store", storeId, citySlug: store.citySlug });
    return store;
  });
}

export async function updateProduct(
  productId: string,
  available: boolean,
  actor: OrderActor,
): Promise<Product> {
  return mutate((db) => {
    const product = db.products.find((item) => item.id === productId);
    if (!product) throw new Error("Product not found");
    product.available = available;
    const store = db.stores.find((item) => item.id === product.storeId);
    recordAudit(db, {
      actorRole: actor.role,
      actorId: actor.id,
      actorName: actor.name,
      action: "product.stock",
      entity: "product",
      entityId: productId,
      summary: `${product.name} marked ${available ? "available" : "sold out"}`,
      after: String(available),
      metadata: { storeId: product.storeId },
    });
    publish({ type: "store", storeId: product.storeId, citySlug: store?.citySlug });
    return product;
  });
}

export type CreateProductInput = {
  storeId: string;
  name: string;
  category: string;
  description?: string;
  price: number;
  available?: boolean;
  popular?: boolean;
  tags?: string[];
  calories?: number;
};

export async function createProduct(
  input: CreateProductInput,
  actor: OrderActor,
): Promise<Product> {
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Item name is required");
  const category = input.category.trim();
  if (!category) throw new Error("Choose a category");
  if (!Number.isFinite(input.price) || input.price <= 0) {
    throw new Error("Enter a price greater than zero");
  }

  return mutate((db) => {
    const store = db.stores.find((item) => item.id === input.storeId);
    if (!store) throw new Error("Store not found");

    const product: Product = {
      id: `product_${randomId("x", 6).slice(2)}`,
      storeId: store.id,
      category,
      name,
      description: input.description?.trim() || "Freshly prepared by the store.",
      price: Math.max(1, Math.round(input.price)),
      emoji: "",
      available: input.available ?? true,
      popular: Boolean(input.popular),
      tags: input.tags?.length ? input.tags : undefined,
      calories:
        typeof input.calories === "number" && Number.isFinite(input.calories)
          ? Math.round(input.calories)
          : undefined,
    };
    db.products.push(product);
    recordAudit(db, {
      actorRole: actor.role,
      actorId: actor.id,
      actorName: actor.name,
      action: "product.create",
      entity: "product",
      entityId: product.id,
      summary: `${product.name} added to ${store.name} at ${product.price} MAD`,
      metadata: { storeId: store.id },
    });
    publish({ type: "store", storeId: store.id, citySlug: store.citySlug });
    return product;
  });
}

export type RegisterDeviceInput = {
  token: string;
  platform: DeviceToken["platform"];
  userId?: string;
};

/**
 * Native push tokens are upserted by token so app updates and re-registration
 * do not create duplicate rows.
 */
export async function registerDevice(input: RegisterDeviceInput): Promise<DeviceToken> {
  const token = input.token.trim();
  if (token.length < 16 || token.length > 4096) throw new Error("Invalid device token");

  return mutate((db) => {
    const now = new Date().toISOString();
    db.devices ??= [];
    const existing = db.devices.find((device) => device.token === token);
    if (existing) {
      existing.platform = input.platform;
      if (input.userId) existing.userId = input.userId;
      existing.updatedAt = now;
      return existing;
    }

    const device: DeviceToken = {
      id: randomId("dev", 6),
      token,
      platform: input.platform,
      userId: input.userId,
      createdAt: now,
      updatedAt: now,
    };
    db.devices.push(device);
    if (db.devices.length > 5000) db.devices.splice(0, db.devices.length - 5000);
    return device;
  });
}

export async function savePushSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  email?: string;
  userId?: string;
  locale?: string;
}): Promise<PushSubscriptionRecord> {
  return mutate((db) => {
    db.pushSubscriptions ??= [];
    const existing = db.pushSubscriptions.find(
      (subscription) => subscription.endpoint === input.endpoint,
    );
    if (existing) {
      existing.p256dh = input.p256dh;
      existing.auth = input.auth;
      if (input.email) existing.email = input.email;
      if (input.userId) existing.userId = input.userId;
      if (input.locale) existing.locale = input.locale;
      return existing;
    }
    const subscription: PushSubscriptionRecord = {
      id: randomId("push", 6),
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      email: input.email,
      userId: input.userId,
      locale: input.locale,
      createdAt: new Date().toISOString(),
    };
    db.pushSubscriptions.push(subscription);
    if (db.pushSubscriptions.length > 2000) {
      db.pushSubscriptions.splice(0, db.pushSubscriptions.length - 2000);
    }
    return subscription;
  });
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  await mutate((db) => {
    db.pushSubscriptions = (db.pushSubscriptions ?? []).filter(
      (subscription) => subscription.endpoint !== endpoint,
    );
  });
}

export async function getPushSubscriptions(filter: {
  email?: string;
  userId?: string;
}): Promise<PushSubscriptionRecord[]> {
  const subscriptions = (await getDb()).pushSubscriptions ?? [];
  return subscriptions.filter(
    (subscription) =>
      (filter.email && subscription.email === filter.email) ||
      (filter.userId && subscription.userId === filter.userId),
  );
}

export type CreateTaxiRideInput = {
  citySlug: string;
  pickupLabel: string;
  dropoffLabel: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
};

function assertCoordinate(lat: number, lng: number): void {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error("Pickup or drop-off location is invalid");
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new Error("Pickup or drop-off location is invalid");
  }
}

export async function createTaxiRide(
  input: CreateTaxiRideInput,
  actor: OrderActor,
): Promise<TaxiRide> {
  assertCoordinate(input.pickupLat, input.pickupLng);
  assertCoordinate(input.dropoffLat, input.dropoffLng);
  const distanceKm = haversineKm(
    { lat: input.pickupLat, lng: input.pickupLng },
    { lat: input.dropoffLat, lng: input.dropoffLng },
  );
  if (distanceKm < 0.15) throw new Error("Pickup and drop-off are too close");
  if (distanceKm > 150) throw new Error("This trip is too long for Wassl Taxi");

  return mutate((db) => {
    const city = db.cities.find((candidate) => candidate.slug === input.citySlug);
    if (!city) throw new Error("City not found");
    if (!actor.id) throw new Error("Please sign in to request a ride");
    const user = db.users.find((candidate) => candidate.id === actor.id);

    const now = new Date().toISOString();
    const ride: TaxiRide = {
      id: `ride_${randomId("x", 6).slice(2)}`,
      customerId: actor.id,
      customerName: actor.name || user?.name || "Customer",
      customerPhone: user?.phone || db.settings.supportPhone,
      citySlug: city.slug,
      pickupLabel: input.pickupLabel.trim() || "Pickup point",
      dropoffLabel: input.dropoffLabel.trim() || "Destination",
      pickupLat: input.pickupLat,
      pickupLng: input.pickupLng,
      dropoffLat: input.dropoffLat,
      dropoffLng: input.dropoffLng,
      distanceKm: Math.round(distanceKm * 100) / 100,
      fare: estimateTaxiFare(distanceKm),
      status: "requested",
      createdAt: now,
      updatedAt: now,
    };
    db.taxiRides ??= [];
    db.taxiRides.push(ride);

    recordAudit(db, {
      actorRole: actor.role,
      actorId: actor.id,
      actorName: actor.name,
      action: "taxi.request",
      entity: "taxi",
      entityId: ride.id,
      summary: `${ride.pickupLabel} → ${ride.dropoffLabel} · ${ride.fare} MAD`,
      after: ride.status,
      metadata: { citySlug: city.slug, distanceKm: ride.distanceKm },
    });
    return ride;
  });
}

export async function getTaxiRide(rideId: string): Promise<TaxiRide | undefined> {
  return (await getDb()).taxiRides?.find((ride) => ride.id === rideId);
}

export async function getTaxiRides(filter?: {
  customerId?: string;
  driverId?: string;
  citySlug?: string;
  status?: TaxiStatus;
  limit?: number;
}): Promise<TaxiRide[]> {
  const rides = (await getDb()).taxiRides ?? [];
  const filtered = rides.filter(
    (ride) =>
      (!filter?.customerId || ride.customerId === filter.customerId) &&
      (!filter?.driverId || ride.driverId === filter.driverId) &&
      (!filter?.citySlug || ride.citySlug === filter.citySlug) &&
      (!filter?.status || ride.status === filter.status),
  );
  filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return filter?.limit ? filtered.slice(0, filter.limit) : filtered;
}

export async function updateTaxiRideStatus(
  rideId: string,
  next: TaxiStatus,
  actor: OrderActor,
): Promise<TaxiRide> {
  return mutate((db) => {
    db.taxiRides ??= [];
    const ride = db.taxiRides.find((candidate) => candidate.id === rideId);
    if (!ride) throw new Error("Ride not found");
    if (!TAXI_TRANSITIONS[ride.status].includes(next)) {
      throw new Error(`A ${ride.status} ride cannot move to ${next}`);
    }

    if (actor.role === "driver") {
      const driver = db.drivers.find((candidate) => candidate.id === actor.driverId);
      if (!driver || !driver.active) throw new Error("Driver profile is not active");
      if (ride.status === "requested" && next === "accepted") {
        ride.driverId = driver.id;
        ride.driverName = driver.name;
        ride.driverPhone = driver.phone;
        ride.vehicle = driver.vehicle;
        ride.plate = driver.plate;
        driver.status = "busy";
      } else if (ride.driverId !== actor.driverId) {
        throw new Error("This ride is assigned to another driver");
      }
    } else if (actor.role === "customer") {
      if (ride.customerId !== actor.id) throw new Error("This is not your ride");
      if (next !== "cancelled") throw new Error("Customers can only cancel a ride");
    } else if (actor.role !== "admin") {
      throw new Error("You do not have access to this action");
    }

    const before = ride.status;
    ride.status = next;
    ride.updatedAt = new Date().toISOString();
    if (next === "completed") {
      ride.completedAt = ride.updatedAt;
      if (ride.driverId) {
        const driver = db.drivers.find((candidate) => candidate.id === ride.driverId);
        if (driver) {
          driver.cashOnHand += ride.fare;
          driver.status = "available";
        }
      }
    }
    if (next === "cancelled" && ride.driverId) {
      const driver = db.drivers.find((candidate) => candidate.id === ride.driverId);
      if (driver && driver.status === "busy") driver.status = "available";
    }

    recordAudit(db, {
      actorRole: actor.role,
      actorId: actor.id,
      actorName: actor.name,
      action: "taxi.status",
      entity: "taxi",
      entityId: ride.id,
      summary: `${ride.pickupLabel} → ${ride.dropoffLabel}: ${before} → ${next}`,
      before,
      after: next,
      metadata: { citySlug: ride.citySlug, fare: ride.fare },
    });
    return ride;
  });
}

export async function updateCity(
  cityId: string,
  patch: Partial<Pick<City, "launchStatus" | "active">>,
  actor: OrderActor,
): Promise<City> {
  return mutate((db) => {
    const city = db.cities.find((item) => item.id === cityId);
    if (!city) throw new Error("City not found");
    const before = `${city.launchStatus}/${city.active}`;
    Object.assign(city, patch);
    recordAudit(db, {
      actorRole: actor.role,
      actorId: actor.id,
      actorName: actor.name,
      action: "city.update",
      entity: "city",
      entityId: cityId,
      summary: `${city.name}: ${before} → ${city.launchStatus}/${city.active}`,
      before,
      after: `${city.launchStatus}/${city.active}`,
    });
    publish({ type: "settings" });
    return city;
  });
}

export async function updateSettings(
  patch: Partial<PlatformSettings>,
  actor: OrderActor,
): Promise<PlatformSettings> {
  return mutate((db) => {
    const changed = Object.keys(patch);
    Object.assign(db.settings, patch);
    recordAudit(db, {
      actorRole: actor.role,
      actorId: actor.id,
      actorName: actor.name,
      action: "settings.update",
      entity: "settings",
      entityId: "platform",
      summary: `Platform settings updated: ${changed.join(", ")}`,
      after: changed.join(", "),
    });
    publish({ type: "settings" });
    return db.settings;
  });
}

export async function getSettings(): Promise<PlatformSettings> {
  return (await getDb()).settings;
}

export async function dashboardStats() {
  const db = await getDb();
  const liveOrders = db.orders.filter(
    (order) => !["delivered", "cancelled"].includes(order.status),
  );
  const delivered = db.orders.filter((order) => order.status === "delivered");
  return {
    ordersToday: db.orders.length,
    liveOrders: liveOrders.length,
    delivered: delivered.length,
    gmv: db.orders
      .filter((order) => order.status === "delivered")
      .reduce((sum, order) => sum + order.total, 0),
    stores: db.stores.length,
    drivers: db.drivers.length,
    onlineDrivers: db.drivers.filter((driver) => driver.status !== "offline").length,
    cities: db.cities.length,
    liveCities: db.cities.filter((city) => city.launchStatus === "live").length,
  };
}
