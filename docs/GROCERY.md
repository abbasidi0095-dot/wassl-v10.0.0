# Wassl Grocery — architecture audit, migration plan and delivery phases

Status: implemented in 10.0.0; this document remains the architecture/migration reference. It extends the
existing delivery + taxi platform; it does not replace or fork it.

## 1. Repository audit

### Stack and persistence
- Next.js 16 App Router, React 19, TypeScript, Tailwind v4, MapLibre, Capacitor.
- One document database (`Database`) persisted as JSON (`WASSL_DATA_DIR`) or a
  Postgres `jsonb` row. All writes go through `mutate()` and append an
  `AuditEntry`.
- Seeded data lives in `src/lib/seed.ts`; `src/data/restaurants.locked.json` is
  checksum-verified and must never be edited.
- Existing optional fields (`grocery`, `devices`, `taxiRides`) prove that adding
  optional document fields is backward compatible: older documents load and are
  hydrated lazily.

### Existing customer flow
- `/` city discovery → `/city/[slug]` → `/store/[slug]` → cart → `/checkout` →
  `/orders/[id]` live tracking (SSE + polling).
- Cart is client-side, one store at a time, line identity = product + modifiers,
  persisted in `localStorage` (`wassl_cart_v2`).
- Checkout supports COD, address/map pin, saved addresses, promos, ASAP or
  scheduled time. The server re-prices options and validates transitions.
- Live activity dock and Web Push already exist from 3.5.0.

### Store / product model
- `Store` has category (`restaurant`, `grocery`, `pharmacy`, `cafe`, `gifts`),
  opening hours, fees, minimum, coordinates and owner. Grocery stores already
  exist but use the restaurant menu UI.
- `Product` is flat: category, price, availability, options/modifiers. No SKU,
  barcode, stock, unit, variant, brand or aisle.
- No stock reservations, no substitutions, no grocery fulfillment mode.

### Roles and staff surfaces
- Customer, merchant, driver, admin; password auth; merchant/driver accounts
  start pending and are approved by admin.
- Merchant dashboard controls menu stock only (available toggle).
- Driver dashboard handles assignment → pickup → en route → delivered with COD.
- Admin console handles stores, drivers, cities, orders, accounts, settings, audit.
- Driver transitions require a driver; pickup orders do not fit that graph yet.

### Systems already reusable
- `quotePromo` (percent/fixed/free delivery), order state machine + audit,
  event bus/SSE, push notifications, map picker, address book, i18n/RTL, theme,
  Capacitor shells, Fly deployment, CI (typecheck/build/unit/e2e/Postgres).

### Gaps this module must close
1. Grocery catalog (departments, aisles, units, SKU/barcode, variants).
2. Inventory and transactional stock reservation/release.
3. Grocery-specific storefront and navigation.
4. Fulfillment modes: delivery, pickup, express, scheduled windows.
5. 24/7 availability that is honest when staff/drivers are unavailable.
6. Night pricing and delivery zones.
7. Substitution preference, loyalty, favorites, shopping lists, refunds.
8. Proof of delivery/pickup, receipts and grocery analytics.
9. Vendor/admin inventory management.
10. Tests, docs and backward-compatible migration.

## 2. Integration approach

- Keep `Store` as the anchor; grocery stores are stores with
  `category: "grocery"` plus `grocery` settings. Do not create a parallel store
  table.
- Extend `Product` with optional grocery fields and a `variants[]` array. A
  product without variants behaves exactly as today.
- Reuse `Order` for grocery orders with optional `fulfillment`, `express`,
  `deliveryWindow`, `deliveryPin`, `substitutionPreference`, loyalty fields and
  `proofOfDelivery`. Restaurant/taxi orders keep their current shape.
- Reuse the client cart, adding optional `variantId`, `unit`, `sku`,
  `stockMax` and `storeCategory`; old localStorage carts still load.
- Add a dedicated `/grocery` experience and `/grocery/[slug]` storefront. Keep
  `/store/[slug]` for restaurants and redirect grocery stores to the new page.
- Add `/merchant/grocery` for catalog/inventory/settings and `/admin/grocery`
  for inventory health, refunds and analytics. Existing dashboards stay intact.
- Extend `createOrder` rather than adding a second order writer, so audit,
  events, push, promo and transition rules stay centralized.
- Extend `updateOrderStatus` with a pickup exception and PIN proof. Do not
  weaken restaurant delivery rules.
- Reuse `quotePromo`, adding grocery-specific rules; reuse `recordAudit` and
  `publish` for stock changes and availability.

## 3. Database / document migration plan

All changes are additive optional fields; no destructive migration.

### New/changed entities
```ts
Store.grocery?: {
  expressEnabled, expressFee, expressMinutes,
  pickupEnabled, alwaysOpen, overnightStaffed,
  nightStart, nightEnd, nightFee,
  schedulingEnabled, scheduleSlots[],
  deliveryZones: [{ id, name, maxKm, fee, minOrder }],
  substitutionDefault, lowStockThreshold, loyaltyPointsPer10Mad
}

Product += sku, barcode, brand, unit, stock, lowStockThreshold,
           aisle, variants[], substitutionAllowed, limitPerOrder

ProductVariant = { id, label, sku, barcode?, price, stock, unit? }

OrderItem += variantId?, variantLabel?, sku?, unit?

Order += fulfillment?, express?, deliveryWindow?, deliveryPin?,
         substitutionPreference?, loyaltyPointsUsed?, loyaltyDiscount?,
         proofOfDelivery?, pickupCode?

User += loyaltyPoints, favorites[], shoppingLists[]

StockReservation = { id, orderId, productId, variantId?, qty,
                     status: reserved|committed|released, timestamps }

RefundRequest = { id, orderId, lines, amount, reason,
                  status: pending|approved|rejected|refunded, adminNote }

Database += stockReservations?, refundRequests?
```

### Backfill rules (run lazily on read/write, no big-bang migration)
- Grocery stores without `grocery` get safe defaults: 24/7 off unless their
  `openingHours` already cover 24h, express/pickup off, no night fee, one default
  zone using the store's existing `deliveryFee`/`minOrder`.
- Products without `stock` remain unlimited; the UI must never show a fake
  stock count for them.
- Existing cart entries without `storeCategory` keep working as restaurant
  carts.
- Existing orders get no `fulfillment`; default interpretation is delivery.
- Existing users get `loyaltyPoints: 0`, empty favorites/lists on demand.

### Indexing / performance
- Document store: derive grocery indexes at read time from `db.stores`,
  `db.products`, `db.orders`; keep payloads capped (`limit`) and avoid full
  catalogue scans in loops.
- Postgres: the document is already `jsonb`; no schema DDL required. If the
  document is later normalized, the optional fields above are the target tables.

## 4. Risk assessment and mitigations

| Risk | Mitigation |
| --- | --- |
| Overselling stock under concurrency | Decrement inside `mutate()` (serialized); create `StockReservation` in the same mutation; release/restock on cancellation/refund. |
| Double-click / duplicate checkout | Existing UI disables submit; add idempotency key per checkout attempt server-side (short-lived, per customer/store). |
| Promising 24/7 when no staff/drivers | Compute availability from opening hours + `overnightStaffed` + active drivers in city; block delivery but allow pickup when honest. |
| Night/express fee disputes | Fees are calculated server-side, never trusted from the client; order stores the applied fees. |
| Pickup breaks driver transition graph | Add explicit `requiresPickup` rule; delivery orders still require a driver. |
| Cash refunds / returns | Refund is a recorded request with admin approval and stock restock; no automated card refund is claimed. |
| Substitution surprises | Customer preference stored on the order; merchant UI shows it; substitution without approval is not automatic. |
| RTL / mobile regressions | Use logical utilities, test 320–414 px in Arabic, reuse existing responsive patterns. |
| Locked snapshot corruption | Never write `restaurants.locked.json`; grocery inventory lives in the runtime document only. |
| Performance on large catalogues | Server paginates/limit + client filters; no unbounded JSON payloads. |
| Back-office i18n gaps | New grocery strings go through `t()`; existing staff labels can remain English until the staff i18n pass. |

## 5. Implementation phases

### Phase 0 — audit and plan (this document)
Acceptance: plan reviewed, no schema changes yet.

### Phase 1 — data model, stock and availability core
- Types + lazy backfill for grocery settings, product stock/variants, order
  fulfillment/PIN fields, reservations, refunds, user favorites/loyalty/lists.
- Pure helpers: `groceryAvailability(store, now, drivers)`, zone selection,
  night fee, stock resolution, fulfillment pricing.
- `createOrder` integration: stock validation/decrement/reservation, zones,
  pickup/express/schedule/night fees, substitution preference, loyalty redeem,
  PIN.
- Cancellation/refund stock release; delivery commit and loyalty earn.
- Unit tests for availability, fares, zones, stock and pickup transitions.

### Phase 2 — customer grocery experience
- `/grocery` discovery (departments, search, open/express/pickup filters).
- `/grocery/[slug]` storefront: aisles, search, sort, stock badges, variants,
  add-to-cart, favorites, recommendations.
- Grocery cart adjustments and `/grocery/checkout` with delivery/pickup,
  express, scheduled slots, night fee, substitution preference and loyalty.
- Order tracking: pickup code/PIN, grocery lines, proof of delivery, receipt.

### Phase 3 — vendor grocery workspace
- `/merchant/grocery`: catalog CRUD with SKU/barcode/unit/aisle, variant editor,
  stock adjustments, low-stock alerts, bulk stock, sold-out.
- Grocery settings: express/pickup/24-7/night/scheduling/zones/substitution.
- Product PATCH APIs with audit + stock events.

### Phase 4 — admin grocery operations
- `/admin/grocery`: inventory value, low/out-of-stock, grocery order metrics,
  refund queue and stock adjustments.
- Refund approve/reject/refund with restock and audit.

### Phase 5 — engagement
- Favorites page/API, shopping lists (create/add/check/remove), loyalty balance
  and redemption, grocery coupon rules, recommendations.

### Phase 6 — proof, returns and receipts
- Delivery PIN required for grocery delivered; pickup code for pickup.
- Refund/return request flow and receipt print view.

### Phase 7 — hardening
- Typecheck/build/unit/e2e/Postgres/overflow/RTL/dark-mode.
- Deploy and document; update README/AGENTS.

## 6. Acceptance criteria

- A customer can browse grocery stores, filter/search, open a product with
  variants, add it to cart, choose delivery/pickup/express/schedule, pay cash
  and track the order.
- Stock decreases once per order line; cancellation/refund restores it exactly
  once; overselling is impossible through the serialized writer.
- Availability copy matches reality: closed/night/unstaffed/no-driver states
  block delivery and explain why; pickup remains available if enabled.
- Vendor can create/edit grocery products, stock and variants; low stock is
  visible; changes are audited and published live.
- Admin can see grocery health and process refund requests.
- Existing restaurant, taxi, auth, admin, dark mode, i18n and tracking tests
  still pass.
- No fake buttons: every new control calls a real endpoint or performs a real
  client operation.
