export type Role = "admin" | "merchant" | "driver" | "customer";

/**
 * Merchants and drivers are created as `pending` and can only reach their
 * workspace after an operator approves them. Customers are active immediately.
 */
export type AccountStatus = "active" | "pending" | "rejected";

export type CityStatus = "live" | "soon";

/** Independently activatable services inside one city. */
export type CityService =
  | "restaurant"
  | "grocery"
  | "taxi"
  | "express"
  | "services"
  | "business";

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
  /** Per-service activation. Missing keys fall back to safe defaults. */
  services?: Partial<Record<CityService, boolean>>;
  /** Migration marker for service defaults. */
  servicesVersion?: number;
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
  requestedKind?: DriverKind;
  requestedPlate?: string;
  loyaltyPoints?: number;
  businessAccountId?: string;
  /** YYYY-MM-DD; used for the yearly birthday reward. */
  birthday?: string;
  favorites?: string[];
  shoppingLists?: ShoppingList[];
  /**
   * Email verification. Older/seeded accounts leave this undefined and are
   * treated as verified; new self-service accounts start as `false`.
   */
  emailVerified?: boolean;
  emailVerifiedAt?: string;
  /** Hashed one-time challenge; the plaintext code is never stored. */
  emailVerification?: EmailVerificationChallenge;
  /**
   * Mobile verification. Legacy accounts leave this undefined and keep their
   * access; new self-service accounts start as `false`.
   */
  phoneVerified?: boolean;
  phoneVerifiedAt?: string;
  phoneVerification?: PhoneVerificationChallenge;
  createdAt?: string;
  lastLoginAt?: string;
}

export interface EmailVerificationChallenge {
  codeHash: string;
  expiresAt: string;
  attempts: number;
  /** Sends inside the current rate-limit window. */
  sends: number;
  windowStartedAt: string;
  lastSentAt: string;
}

export type PhoneVerificationChallenge = EmailVerificationChallenge;

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
  /** Merchant-supplied cover image, stored as a data URL or absolute URL. */
  image?: string;
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
  /** Merchant-supplied product image, stored as a data URL or absolute URL. */
  image?: string;
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
  /** Optional wholesale price for approved business accounts. */
  businessPrice?: number;
  businessMinQty?: number;
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

export type DriverKind = "delivery" | "taxi" | "both";

export interface Driver {
  id: string;
  name: string;
  phone: string;
  email: string;
  citySlug: string;
  vehicle: string;
  plate: string;
  /** Delivery courier, taxi driver, or both. Defaults to delivery for legacy rows. */
  kind?: DriverKind;
  /** Data-URL or absolute image URL. Shown in dispatch, taxi and customer views. */
  photo?: string;
  status: DriverStatus;
  lat: number;
  lng: number;
  rating: number;
  /** Number of customer ratings contributing to the average. */
  ratingsCount?: number;
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
  image?: string;
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
  /** Automatic grocery promotion discount, separate from a promo code. */
  promotionDiscount?: number;
  appliedPromotions?: string[];
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
  /** True when a four-digit handover is required; safe to expose to drivers. */
  handoverRequired?: boolean;
  /** Customer rating submitted after delivery. */
  rating?: Rating;
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

export type ServiceCommissionId = "food" | "grocery" | "pharmacy" | "taxi";

export interface ServiceCommission {
  /** Percentage of the goods subtotal or ride fare. */
  rate: number;
  /** Flat amount in MAD per fulfilled job. */
  fixedFee: number;
}

export type ServiceCommissions = Record<ServiceCommissionId, ServiceCommission>;

export interface PlatformSettings {
  brandName: string;
  brandNameAr: string;
  tagline: string;
  supportPhone: string;
  currency: string;
  /** Merchant payout commission, separate from per-service platform fees. */
  commissionRate: number;
  /** What Wassl keeps on each completed service. */
  commissions?: ServiceCommissions;
  defaultDeliveryFee: number;
  primaryColor: string;
  accentColor?: string;
  themePreset?: "coastal" | "aero" | "midnight" | "sand" | "custom";
  defaultTheme?: "system" | "light" | "dark";
  /** Optional square or wordmark logo, stored as a data URL. */
  logoImage?: string;
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

export interface TaxiStop {
  id: string;
  label: string;
  lat: number;
  lng: number;
}

export type TaxiRideType = "local" | "intercity" | "airport";

export interface TaxiLostItem {
  description: string;
  contact: string;
  status: "open" | "resolved";
  createdAt: string;
}

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
  driverPhoto?: string;
  vehicle?: string;
  plate?: string;
  /** Four-digit handover code the customer shares before the trip is closed. */
  verificationCode?: string;
  /** Safe driver-facing flag; the code itself is never sent to drivers. */
  handoverRequired?: boolean;
  codeVerifiedAt?: string;
  rideType?: TaxiRideType;
  scheduledFor?: string;
  stops?: TaxiStop[];
  passengerCount?: number;
  luggage?: string;
  notes?: string;
  /** Public read-only live link token. */
  shareToken?: string;
  lostItem?: TaxiLostItem;
  rating?: Rating;
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

export type ServiceCategory =
  | "laundry"
  | "cleaning"
  | "plumbing"
  | "electrical"
  | "maintenance"
  | "moving"
  | "other";

export type ServiceProviderStatus = "pending" | "approved" | "suspended";

export interface ServiceProvider {
  id: string;
  name: string;
  category: ServiceCategory;
  citySlug: string;
  description: string;
  phone: string;
  address: string;
  priceFrom: number;
  rating: number;
  reviews: number;
  active: boolean;
  status: ServiceProviderStatus;
  accessCode: string;
  createdAt: string;
}

export type ServiceBookingStatus =
  | "requested"
  | "confirmed"
  | "completed"
  | "cancelled";

export interface ServiceBooking {
  id: string;
  code: string;
  providerId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  citySlug: string;
  service: string;
  description: string;
  address: string;
  landmark: string;
  date: string;
  slot: string;
  status: ServiceBookingStatus;
  amount?: number;
  createdAt: string;
  updatedAt: string;
}

export type BusinessAccountStatus = "pending" | "approved" | "rejected";

export interface BusinessAccount {
  id: string;
  ownerId: string;
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  citySlug: string;
  category: string;
  status: BusinessAccountStatus;
  createdAt: string;
  updatedAt: string;
}

export type BusinessOrderStatus = "requested" | "confirmed" | "cancelled";

export interface BusinessOrderLine {
  productId: string;
  storeId: string;
  name: string;
  qty: number;
  unitPrice: number;
}

export interface BusinessOrder {
  id: string;
  code: string;
  accountId: string;
  customerId: string;
  citySlug: string;
  storeId: string;
  items: BusinessOrderLine[];
  subtotal: number;
  deliveryDate: string;
  notes?: string;
  status: BusinessOrderStatus;
  createdAt: string;
  updatedAt: string;
}

export type ParcelSize = "document" | "small" | "medium" | "large";

export type ParcelStatus =
  | "requested"
  | "accepted"
  | "picked_up"
  | "in_transit"
  | "delivered"
  | "cancelled";

export interface ParcelDelivery {
  id: string;
  code: string;
  trackingCode: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  citySlug: string;
  pickupLabel: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLabel: string;
  dropoffLat: number;
  dropoffLng: number;
  recipientName: string;
  recipientPhone: string;
  size: ParcelSize;
  description: string;
  notes?: string;
  distanceKm: number;
  fare: number;
  status: ParcelStatus;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  /** Sender-only pickup verification code. */
  pickupCode: string;
  /** Sender-only handover code to share with the recipient. */
  deliveryCode: string;
  codeVerifiedAt?: string;
  proofOfDelivery?: {
    method: "pickup_code" | "delivery_code";
    at: string;
  };
  createdAt: string;
  updatedAt: string;
  acceptedAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
}

export type ChatTopic =
  | "support"
  | "order"
  | "ride"
  | "delivery"
  | "grocery"
  | "account";

export type ChatParticipantRole =
  | "customer"
  | "driver"
  | "merchant"
  | "admin"
  | "assistant";

export type ChatThreadStatus = "open" | "waiting" | "closed";

export interface ChatThread {
  id: string;
  topic: ChatTopic;
  subject: string;
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  orderId?: string;
  rideId?: string;
  storeId?: string;
  driverId?: string;
  status: ChatThreadStatus;
  /** True while the Wassl assistant may answer customer messages. */
  aiEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  lastMessagePreview: string;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  senderId?: string;
  senderRole: ChatParticipantRole;
  senderName: string;
  body: string;
  source: "user" | "ai" | "system";
  readBy: string[];
  createdAt: string;
}

export interface Rating {
  stars: number;
  comment?: string;
  at: string;
}

export type LoyaltyTier = "basic" | "plus" | "premium";

export type LoyaltyTransactionType =
  | "earn"
  | "redeem"
  | "refund"
  | "adjust"
  | "referral"
  | "birthday"
  | "campaign";

export interface LoyaltyAccount {
  userId: string;
  points: number;
  lifetimePoints: number;
  tier: LoyaltyTier;
  referralCode: string;
  referredBy?: string;
  referralRewarded?: boolean;
  joinedAt: string;
}

export interface LoyaltyTransaction {
  id: string;
  userId: string;
  type: LoyaltyTransactionType;
  /** Positive for earned/refunded, negative for redeemed/expired. */
  points: number;
  balanceAfter: number;
  lifetimeAfter: number;
  orderId?: string;
  note?: string;
  actorRole?: Role | "system";
  actorName?: string;
  createdAt: string;
}

export interface LoyaltyReward {
  id: string;
  title: string;
  description: string;
  pointsCost: number;
  kind: "grocery_credit" | "delivery" | "discount";
  value: number;
  storeId?: string;
  active: boolean;
}

export type GroceryPromotionKind = "flash" | "quantity" | "bulk";

export interface GroceryPromotion {
  id: string;
  title: string;
  kind: GroceryPromotionKind;
  storeId?: string;
  productIds?: string[];
  categories?: string[];
  percentOff: number;
  minQty: number;
  minSubtotal?: number;
  startsAt: string;
  endsAt: string;
  active: boolean;
}

export type RecurringFrequency = "weekly" | "monthly";

export interface ShoppingListRecurring {
  enabled: boolean;
  frequency: RecurringFrequency;
  /** ISO date for the next reminder. Never creates an automatic order. */
  nextAt?: string;
  remind: boolean;
}

export interface ShoppingList {
  id: string;
  name: string;
  items: ShoppingListItem[];
  recurring?: ShoppingListRecurring;
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
  promotions?: GroceryPromotion[];
  loyaltyAccounts?: LoyaltyAccount[];
  loyaltyTransactions?: LoyaltyTransaction[];
  loyaltyRewards?: LoyaltyReward[];
  chatThreads?: ChatThread[];
  chatMessages?: ChatMessage[];
  parcels?: ParcelDelivery[];
  serviceProviders?: ServiceProvider[];
  serviceBookings?: ServiceBooking[];
  businessAccounts?: BusinessAccount[];
  businessOrders?: BusinessOrder[];
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
