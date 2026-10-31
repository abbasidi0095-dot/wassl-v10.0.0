export type Role = "admin" | "merchant" | "driver" | "customer";

/**
 * Merchants and drivers are created as `pending` and can only reach their
 * workspace after an operator approves them. Customers are active immediately.
 */
export type AccountStatus = "active" | "pending" | "rejected";

export type CityStatus = "live" | "soon";

export interface City {
  id: string;
  slug: string;
  name: string;
  nameAr: string;
  lat: number;
  lng: number;
  population: number;
  region: string;
  priority: boolean;
  active: boolean;
  launchStatus: CityStatus;
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: Role;
  storeId?: string;
  driverId?: string;
  phone?: string;
  citySlug?: string;
  accountStatus?: AccountStatus;
  /** Merchant sign-up detail; used to provision the store on approval. */
  requestedStoreName?: string;
  /** Driver sign-up detail; used to provision the courier profile. */
  requestedVehicle?: string;
  loyaltyPoints?: number;
  favorites?: string[];
  shoppingLists?: ShoppingList[];
  createdAt?: string;
  lastLoginAt?: string;
}

export type StoreCategory =
  | "restaurant"
  | "grocery"
  | "pharmacy"
  | "cafe"
  | "gifts";

export interface Store {
  id: string;
  slug: string;
  name: string;
  nameAr: string;
  citySlug: string;
  category: StoreCategory;
  tagline: string;
  description: string;
  address: string;
  landmark: string;
  lat: number;
  lng: number;
  accent: string;
  rating: number;
  reviews: number;
  prepTime: number;
  minOrder: number;
  deliveryFee: number;
  isOpen: boolean;
  commissionRate: number;
  phone: string;
  ownerName: string;
  /** Where the establishment record came from. */
  dataOrigin?: "wassl" | "marocapis";
  /** Directory id (MarocAPIs place id) when the record is imported. */
  externalId?: string;
  /** Locked records cannot be edited or deleted at runtime. */
  locked?: boolean;
  /** Dietary tags available across this store's menu. */
  dietaryTags?: string[];
  /** 1 = budget, 2 = mid-range, 3 = premium. */
  priceLevel?: 1 | 2 | 3;
  tags?: string[];
  openingHours?: OpeningHours[];
  /** False when imported coordinates disagree with the city centre. */
  coordinateVerified?: boolean;
  /** Free-text provenance line shown in the admin data-source view. */
  verifiedAt?: string;
  /** Public source page for an imported establishment. */
  sourceUrl?: string | null;
  /** Grocery/supermarket settings. Absent on restaurants and older records. */
  grocery?: GrocerySettings;
}

export interface GroceryZone {
  id: string;
  name: string;
  maxKm: number;
  fee: number;
  minOrder: number;
}

export interface GrocerySettings {
  expressEnabled: boolean;
  expressFee: number;
  expressMinutes: number;
  pickupEnabled: boolean;
  /** 24/7 ordering. Still subject to overnight staffing and driver capacity. */
  alwaysOpen: boolean;
  overnightStaffed: boolean;
  nightStart: string;
  nightEnd: string;
  nightFee: number;
  schedulingEnabled: boolean;
  scheduleSlots: string[];
  deliveryZones: GroceryZone[];
  substitutionDefault: "allow" | "refund" | "contact";
  lowStockThreshold: number;
  /** Loyalty points earned per 10 MAD of grocery spend. */
  loyaltyPointsPer10Mad: number;
}

export interface OpeningHours {
  days: string;
  open: string;
  close: string;
}

export interface ModifierOption {
  id: string;
  name: string;
  priceDelta: number;
  soldOut?: boolean;
}

export interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  min: number;
  max: number;
  options: ModifierOption[];
}

export interface SelectedModifier {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
}

export interface Product {
  id: string;
  storeId: string;
  category: string;
  name: string;
  description: string;
  price: number;
  emoji: string;
  available: boolean;
  popular?: boolean;
  /** Part of a locked, read-only menu snapshot. */
  locked?: boolean;
  tags?: string[];
  modifiers?: ModifierGroup[];
  calories?: number;
  /* Grocery fields. Optional so restaurant products are unchanged. */
  sku?: string;
  barcode?: string;
  brand?: string;
  unit?: string;
  stock?: number;
  lowStockThreshold?: number;
  aisle?: string;
  variants?: ProductVariant[];
  substitutionAllowed?: boolean;
  limitPerOrder?: number;
}

export interface ProductVariant {
  id: string;
  label: string;
  sku: string;
  barcode?: string;
  price: number;
  stock: number;
  unit?: string;
}

export type DriverStatus = "offline" | "available" | "busy";

export interface Driver {
  id: string;
  name: string;
  phone: string;
  email: string;
  citySlug: string;
  vehicle: string;
  plate: string;
  status: DriverStatus;
  lat: number;
  lng: number;
  rating: number;
  deliveries: number;
  cashOnHand: number;
  cashLimit: number;
  active: boolean;
}

export type OrderStatus =
  | "placed"
  | "accepted"
  | "preparing"
  | "ready"
  | "assigned"
  | "picked_up"
  | "en_route"
  | "delivered"
  | "cancelled";

export interface OrderItem {
  productId: string;
  name: string;
  emoji: string;
  price: number;
  qty: number;
  options?: SelectedModifier[];
  variantId?: string;
  variantLabel?: string;
  sku?: string;
  unit?: string;
}

export interface OrderEvent {
  id: string;
  type: string;
  label: string;
  at: string;
  note?: string;
}

export interface Order {
  id: string;
  code: string;
  citySlug: string;
  storeId: string;
  driverId?: string;
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  address: string;
  landmark: string;
  notes?: string;
  lat: number;
  lng: number;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  /** Applied promo code and the amount it took off the order. */
  promoCode?: string;
  discount?: number;
  paymentMethod: "cod";
  scheduledFor?: string;
  createdAt: string;
  updatedAt: string;
  acceptedAt?: string;
  readyAt?: string;
  assignedAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  cashCollected?: boolean;
  fulfillment?: "delivery" | "pickup";
  express?: boolean;
  deliveryWindow?: string;
  deliveryPin?: string;
  pickupCode?: string;
  substitutionPreference?: "allow" | "refund" | "contact";
  loyaltyPointsUsed?: number;
  loyaltyDiscount?: number;
  proofOfDelivery?: {
    method: "pin";
    note?: string;
    at: string;
  };
  idempotencyKey?: string;
  cancellationReason?: string;
  events: OrderEvent[];
}

export type AuditEntity =
  | "order"
  | "store"
  | "product"
  | "driver"
  | "city"
  | "settings"
  | "auth"
  | "taxi";

export interface AuditEntry {
  id: string;
  at: string;
  actorRole: Role | "system" | "customer";
  actorId?: string;
  actorName?: string;
  action: string;
  entity: AuditEntity;
  entityId: string;
  summary: string;
  before?: string;
  after?: string;
  note?: string;
  metadata?: Record<string, string | number | boolean | undefined>;
}

export interface PlatformSettings {
  brandName: string;
  brandNameAr: string;
  tagline: string;
  supportPhone: string;
  currency: string;
  commissionRate: number;
  defaultDeliveryFee: number;
  primaryColor: string;
  cityWaitlistEnabled: boolean;
}

/**
 * Push registration for the native shells. A token belongs to one install; it
 * is upserted so re-registering after an app update does not duplicate rows.
 */
export interface DeviceToken {
  id: string;
  token: string;
  platform: "ios" | "android" | "web";
  userId?: string;
  createdAt: string;
  updatedAt: string;
}

export type TaxiStatus =
  | "requested"
  | "accepted"
  | "arriving"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface TaxiRide {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  citySlug: string;
  pickupLabel: string;
  dropoffLabel: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  distanceKm: number;
  fare: number;
  status: TaxiStatus;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  vehicle?: string;
  plate?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface PushSubscriptionRecord {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  email?: string;
  userId?: string;
  locale?: string;
  createdAt: string;
}

export interface ShoppingListItem {
  productId: string;
  qty: number;
  checked?: boolean;
}

export interface ShoppingList {
  id: string;
  name: string;
  items: ShoppingListItem[];
  createdAt: string;
  updatedAt: string;
}

export interface StockReservation {
  id: string;
  orderId: string;
  productId: string;
  variantId?: string;
  qty: number;
  status: "reserved" | "committed" | "released";
  createdAt: string;
  updatedAt: string;
}

export interface RefundLine {
  productId: string;
  name: string;
  qty: number;
  amount: number;
}

export interface RefundRequest {
  id: string;
  orderId: string;
  customerEmail?: string;
  reason: string;
  lines: RefundLine[];
  amount: number;
  status: "pending" | "approved" | "rejected" | "refunded";
  restock: boolean;
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Database {
  users: User[];
  cities: City[];
  stores: Store[];
  products: Product[];
  drivers: Driver[];
  orders: Order[];
  addresses: CustomerAddress[];
  auditLogs: AuditEntry[];
  settings: PlatformSettings;
  /** Native push tokens. Optional so older persisted databases still load. */
  devices?: DeviceToken[];
  /** Ride-hailing records. Optional so older persisted databases still load. */
  taxiRides?: TaxiRide[];
  /** Browser Web Push subscriptions. */
  pushSubscriptions?: PushSubscriptionRecord[];
  stockReservations?: StockReservation[];
  refundRequests?: RefundRequest[];
}

/**
 * Guest address book. The browser keeps a random token in local storage; the
 * server never exposes an address without it.
 */
export interface CustomerAddress {
  id: string;
  token: string;
  label: string;
  name: string;
  phone: string;
  address: string;
  landmark: string;
  lat: number;
  lng: number;
  createdAt: string;
  lastUsedAt: string;
}

export interface Session {
  userId: string;
  role: Role;
  name: string;
  email?: string;
  status?: AccountStatus;
  storeId?: string;
  driverId?: string;
}

export const STATUS_META: Record<
  OrderStatus,
  { label: string; labelAr: string; tone: string }
> = {
  placed: { label: "Order placed", labelAr: "تم الطلب", tone: "amber" },
  accepted: { label: "Store accepted", labelAr: "قبل المتجر", tone: "teal" },
  preparing: { label: "Preparing", labelAr: "قيد التحضير", tone: "teal" },
  ready: { label: "Ready for pickup", labelAr: "جاهز للاستلام", tone: "blue" },
  assigned: { label: "Driver assigned", labelAr: "تم تعيين سائق", tone: "blue" },
  picked_up: { label: "Picked up", labelAr: "تم الاستلام", tone: "indigo" },
  en_route: { label: "On the way", labelAr: "في الطريق", tone: "indigo" },
  delivered: { label: "Delivered", labelAr: "تم التوصيل", tone: "green" },
  cancelled: { label: "Cancelled", labelAr: "ملغى", tone: "red" },
};
