# Wassl 11.0 — implementation progress

Target: **11.0.0** unified Moroccan super-app.
Current delivered baseline: **11.0.0-alpha.4** (1 November 2026).
Production: not deployed from this milestone without explicit authorization.

This document records exact progress. It is not a claim that the full 11.0
programme is complete.

---

## Delivered in 11.0.0-alpha.1

### Unified search

- New `/search` page and `/api/search`.
- Searches persisted Wassl data across:
  - restaurants, cafés, grocery, pharmacy and gift stores
  - products, including SKU, barcode, brand, aisle and variants
  - store categories and grocery aisles
  - enabled services for the selected city
  - pickup, express and scheduled delivery options
- Recent searches stored locally.
- Suggestions and grouped results.
- Latin and Arabic normalization, diacritic stripping and bounded
  Levenshtein typo tolerance.
- City selector and city-aware ranking.
- Search entry point in the desktop nav, header icon and mobile menu.
- Product results deep-link to `/store/[slug]?product=[id]` and open the product
  sheet; store results open the storefront.
- City and grocery pages accept query/category/filter parameters from search.

### Deterministic personalized home

- New “For you” section built from:
  - recent purchased products and reorder suggestions
  - frequently ordered stores
  - favourites
  - popular in-stock grocery products
  - nearby open stores
  - Casablanca time of day
  - city-valid promotions
- Works without any external AI provider.
- Cold-start users see real popular and open stores from their city.
- No invented availability, prices or promises.

### Service-level city activation

- `City.services` supports restaurant, grocery, taxi, Express, local services and
  business independently.
- Admin **Cities → Services** edits the matrix per city, with an audit record.
- Existing live cities default to restaurant, grocery and taxi on; Express,
  services and business default off.
- Home doors, desktop/mobile navigation and search service results respect the
  active services.
- Turning one service off never disables the others.

### Grocery 2.0 subset

- **Wassl Basket** at `/grocery/basket`: searches grocery products across
  stores, compares prices, groups lines by store, shows per-store delivery fees
  and minimums, and lets the customer choose substitutions.
- **Split checkout** at `/grocery/basket/checkout`: one delivery address creates
  one independent cash order per store. Each order keeps its own delivery fee,
  driver and handover code. Successful stores are removed from the basket;
  failed stores remain for retry with idempotency keys.
- **Barcode lookup** at `/grocery/scan` and `/api/grocery/barcode`: camera
  scanning when `BarcodeDetector` is available, manual entry everywhere.
- **Recurring baskets**: shopping lists store weekly/monthly frequency, a next
  reminder date and a remind toggle. No automatic orders are placed.
- Unit tests cover grouping, fees, minimums, malformed storage, stock caps,
  mixed cities and recurring dates.
- Playwright covers barcode → basket and recurring-list settings.

### Grocery intelligence and promotions

- Smart shopping assistant at `/grocery/assistant` with deterministic recipe
  matching, cheapest-product intent, usual-purchase suggestions and an editable
  list that adds to Wassl Basket.
- Server-side grocery promotion engine: flash, quantity, bulk, scheduled and
  store-wide offers. Discounts are applied in `createOrder`; badges appear on
  the grocery storefront. Default merchant-specific offers are seeded.
- Inventory intelligence: sales velocity, top sellers, slow movers, suggested
  restock, one-click restock and recent stock movements.
- Still missing: a merchant/admin promotion builder, manual stock-adjustment
  history and replenishment forecasting beyond the 14-day velocity model.

### Wassl Club core

- Immutable loyalty ledger with opening-balance migration.
- Basic / Plus / Premium tiers with lifetime progress.
- Earn on completed orders, redeem at grocery checkout, return points on
  cancellation, audited admin adjustments.
- Customer dashboard at `/account/loyalty` with points, history and rewards.
- Still missing: referral attribution, birthday rewards, reward redemption
  codes, expiration jobs, campaign bonuses and admin threshold/ratio controls.

### Supporting changes

- `src/lib/db.ts` adds `getPopularProducts()`.
- `src/lib/search.ts` is a pure, testable search scorer.
- `src/lib/personalization.ts` is a pure, testable feed builder.
- Added `tests/search.test.ts`, `tests/personalization.test.ts` and
  `tests/city-services.test.ts`.
- Added two Playwright cases for typo search/product deep links and the home
  feed, plus an admin city-services case.

---

## Verification

- `npx tsc --noEmit` — clean.
- `npm test` — 108 passed, 4 skipped.
- `npm run e2e` — 19 passed.
- `npm run build` — clean.
- Manual checks at 1440px and 390px: no horizontal overflow on home or search.
- Product deep link opens the product dialog.
- Search supports `dakhla gril` → Dakhla Grill.
- Home “For you” renders six real cards and city-valid promotions.

---

## Feature status against the 11.0 brief

| Area | Status | Notes |
|---|---|---|
| Unified identity, account, addresses, notifications | Delivered | Support centre still missing |
| Shared favourites | Partial | Grocery product favourites; merchant favourites remain |
| Shared order history | Delivered | Orders and taxi rides share `/orders` tabs |
| Unified search | Delivered (alpha) | Taxi saved destinations arrive with Taxi 2.0 |
| Service-level city activation | Delivered | Admin per-city service matrix |
| Unified design language | Delivered | Coastal Manifest + Aero glass |
| Consistent bottom navigation | Delivered | Delivery, grocery, taxi, orders and account remain visible |
| Home prioritization | Partial | Restaurants, grocery, taxi, services and business exist; Express and local services await their workflows |
| Personalized discovery | Delivered (deterministic) | Uses real orders, favourites, stock, hours and time of day |
| Grocery 2.0 | Delivered (core) | Basket, split checkout, barcode, recurring lists, assistant, promotions and inventory intelligence delivered; merchant promotion builder and deeper forecasting remain |
| Wassl Club | Partial | Ledger, tiers, earn/redeem, dashboard and admin adjustments delivered; referrals, birthday, reward codes, expiry and campaign controls remain |
| Wassl AI | Not started | Provider abstraction and three assistants |
| Taxi 2.0 | Partial | Scheduled, multi-stop, saved places, ratings, lost-and-found, intercity, zones, heatmaps |
| Wassl Express | Not started | Parcel vertical |
| Local services marketplace | Not started | Provider and booking workflows |
| Business / wholesale | Not started | B2B accounts and catalogue |
| Merchant Growth 2.0 | Partial | Order board and basic analytics; staff, campaigns, capacity, forecasting |
| Driver Intelligence 2.0 | Partial | GPS, queue and wallet; heatmaps, break/emergency, incentives, batch |
| Admin Intelligence 2.0 | Partial | Profit analytics and city service matrix; alerts and support still missing |
| Advanced retention | Not started | Referrals, achievements, reminders, birthday, abandoned cart |
| Maps and routing | Partial | MapLibre/OSM; no routing abstraction |
| Security and privacy | Strong baseline | New verticals and AI tools still need validation |

---

## Files changed in this milestone

- `src/lib/search.ts` — new search scorer and result builder.
- `src/lib/city-services.ts` — new service defaults, merge and sanitisation.
- `src/lib/basket.ts` — cross-store basket grouping, totals and recurring dates.
- `src/lib/grocery-assistant.ts` — deterministic shopping assistant.
- `src/lib/grocery-promotions.ts` — server-validated grocery offers.
- `src/lib/inventory.ts` — inventory and replenishment intelligence.
- `src/lib/loyalty.ts` — tiers, earning rules and rewards.
- `src/lib/personalization.ts` — new deterministic home-feed builder.
- `src/app/api/search/route.ts` — new search API.
- `src/app/search/page.tsx` — search route shell.
- `src/app/search/search-experience.tsx` — search UI.
- `src/components/home-feed.tsx` — personalized home section.
- `src/components/site-header.tsx` — search entry points.
- `src/app/page.tsx` — customer history, popular products and home feed.
- `src/app/store/[slug]/page.tsx` — product deep links.
- `src/components/store-menu.tsx` — opening a deep-linked product.
- `src/components/grocery-store.tsx` — opening a deep-linked product.
- `src/app/city/[slug]/page.tsx` — query/category parameters.
- `src/components/store-browser.tsx` — initial query/category.
- `src/app/grocery/page.tsx` — query/filter parameters.
- `src/app/grocery/grocery-browser.tsx` — initial query/filter.
- `src/lib/db.ts` — popular products query and city service patch.
- `src/app/grocery/basket/` — planner and split checkout.
- `src/app/grocery/scan/` — barcode scanner.
- `src/app/api/grocery/barcode/route.ts` — barcode resolution.
- `src/app/grocery/lists/lists-view.tsx` — recurring list controls.
- `src/app/admin/admin-console.tsx` — per-city services dialog.
- `src/app/api/admin/cities/route.ts` — service patch validation.
- `src/lib/i18n.ts` — EN/FR/ES/AR strings.
- `tests/search.test.ts` — new.
- `tests/personalization.test.ts` — new.
- `tests/city-services.test.ts` — new.
- `tests/basket.test.ts` — new.
- `tests/grocery-assistant.test.ts` — new.
- `tests/grocery-promotions.test.ts` — new.
- `tests/inventory.test.ts` — new.
- `tests/loyalty.test.ts` — new.
- `e2e/customer.spec.ts` — two new cases.
- `README.md`, `AGENTS.md`, `package.json` — milestone documentation.

---

## Exact next steps

1. **Phase 1B — remaining foundations**
   - Merchant favourites and shared favourite surfaces.
   - Server-validated promotion engine foundation for flash, quantity and bulk
     offers.
   - Support-ticket base and notification preferences.
2. **Phase 2 — Grocery 2.0 remaining**
   - Merchant/admin promotion builder.
   - Manual stock-adjustment history and richer forecasting.
3. **Phase 3 — Wassl Club remaining**
   - Referral attribution, birthday rewards, reward redemption codes, expiration
     jobs, campaign bonuses and admin ratio/threshold controls.
4. **Later phases**
   - Merchant Growth, Driver Intelligence, Taxi 2.0, Express, Services,
     Business, AI and Admin Intelligence.

No production deployment has been performed for this milestone. The live site
remains on 10.8.0 until an explicit deployment instruction is given.
