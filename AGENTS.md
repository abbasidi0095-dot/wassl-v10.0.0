<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS — Wassl v11.0.0

This file is the handover guide for coding agents. Read it before changing the
app. The user-facing summary lives in [README.md](README.md); this file records
the architecture, hard constraints and the full change history.

## Snapshot

- Release: **11.3.1** (1 November 2026; cobalt and tangerine palette)
- Live: <https://wassl.shop>
- Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4,
  MapLibre GL, Capacitor 8 (iOS/Android), JSON or Postgres document store.
- Product: local delivery + **Wassl Grocery** + **Wassl Taxi**, cash only (COD / cash fare).
- Languages: English, French, Spanish, Arabic (RTL). Theme: light + dark.
- Native app id: `ma.wassl.app`.

## Commands

```bash
npm install
npm run dev              # local dev
npm run typecheck        # tsc --noEmit
npm test                 # 72 Vitest tests
npm run test:pg          # Postgres integration tests
npm run build            # production build
PLAYWRIGHT_PORT=3510 npx playwright test   # 10 e2e tests
npm run mobile:sync      # Capacitor sync
npm run mobile:apk       # debug APK (Android SDK + JDK 21)
```

Android SDK used on this machine: `/tmp/opencode/android-sdk` (not committed).
Java 21 is required. iOS builds need macOS/Xcode 16+.

## Architecture map

```
src/app/            routes (customer, grocery, taxi, store, cart, checkout,
                    orders, merchant, driver, admin, auth, APIs)
src/components/     site/staff headers, menu, map, product icons, live activity,
                    notification bell, ongoing tracker, locale/theme providers
src/lib/            db.ts (all mutations + audit), i18n.ts, push.ts, taxi.ts,
                    grocery.ts (availability, zones, fees, stock),
                    email.ts (Brevo), email-verification.ts (OTP lifecycle),
                    order-machine.ts, auth.ts, security.ts, events.ts
src/data/           cities.json (209), restaurants.locked.json (checksum-locked)
android/ ios/       Capacitor native shells
mobile/www/         bundled offline fallback for the shell
public/             icons, manifest, store photography, sw.js
```

Persistence is a single `Database` document (`src/lib/types.ts`) in
`data/db.json` or a Postgres `jsonb` row. `mutate()` serializes writes and
persists; every mutation should add an audit entry via `recordAudit`.

## Hard constraints

1. **Never edit `src/data/restaurants.locked.json`.** It is checksum-verified by
   `verifySnapshotIntegrity()` and produced by the import script.
2. **Cash only.** No card/PayPal/IAP flows. Delivery is COD; taxi fares are cash.
3. **One Wassl brand**, one storefront, `ma.wassl.app` native id.
4. **Keep 209 Moroccan cities**; priority cities are Dakhla, Laâyoune, Boujdour,
   Esmara, Tarfaya.
5. **No emoji as imagery.** Use Lucide icons, `ProductTile`, or real photos in
   `public/images/stores`.
6. CSS base styles must stay inside `@layer base` / `@layer components`.
   Unlayered rules override Tailwind utilities (this caused two regressions).
7. Prefer logical utilities (`ms/me/ps/pe/start/end`, `text-start/end`) so Arabic
   RTL keeps working. Centered toasts intentionally keep `left-1/2`.
8. UI follows `DESIGN-SYSTEM.md`: tokens only, no gradient washes or glass, no
   emoji, sentence-case labels, tabular figures, 44px controls.
9. Grocery stock is decremented/reserved inside `mutate()` only. Never trust
   client price/stock; use `resolveProductStock` and `groceryFees`. Release on
   cancellation, commit on delivery, restock on refund.
10. Verification codes are stored only as HMACs; never log a code, return it
    outside `WASSL_OTP_TEST_MODE`, or email it to an address the user did not
    just prove they control.
11. Customer-facing strings should go through `t()`; the English string is the
    dictionary key and missing translations fall back safely.
12. Never commit secrets. `WASSL_SECRET`, `VAPID_*`, database URLs and admin
   passwords live in the host environment.

## Change history (newest first)

### 11.3.1 — palette fallback polish
- Dark-mode signal fallbacks now use the new tangerine.

### 11.3.0 — cobalt and tangerine palette
- Default palette is Wassl Blue `#2447E0`, Night Ink `#101A33`, Limestone
  `#F7F2E8`, Signal Tangerine `#FF8A3D`.
- All four presets, dark mode, splash, icons, launch images, offline page,
  email, map route and confetti were recoloured.
- `hydrate()` migrates the old green/saffron settings once.
- `tests/brand.test.ts` now checks WCAG AA for key text pairs.

### 11.2.2 — tabs open at the top
- `ScrollToTop` resets window scroll on pathname changes (Next 16 kept the
  previous position), with a second reset on iOS focus settle.
- Browser back/forward is left to native scroll restoration.
- Regression test: scroll to the bottom, tap Grocery, expect `scrollY === 0`.

### 11.2.1 — ticker edge fade
- Ticker edges fade into the strip in light, dark and RTL.

### 11.2.0 — pharmacy, promo ticker and focused launcher
- Launcher: Food to go, Grocery, Pharmacy, Taxi. Express, Services and Business
  removed from customer navigation; their admin/merchant operations remain.
- `/pharmacy` page: licensed partners, live stock, OTC products and an honest
  no-partner-yet state.
- `PromoTicker` on home: promo codes (copyable), city news and service news.
  Pauses on hover/focus; static and scrollable for reduced motion.
- "See all restaurants and cafés" moved below the store grid.
- Dock: Home, Food, Grocery, Pharmacy, Account.

### 11.1.0 — simple launcher home
- `src/app/page.tsx` reduced from 879 to ~270 lines: search, quick links,
  in-progress jobs, six services, open-now picks.
- Mobile header trimmed to search, notifications, cart and menu; city, language,
  theme and account live in the menu or on desktop.
- Five-tab dock (Home, Grocery, Taxi, Orders, Account); Express, Services and
  Business stay reachable from the launcher and menu.
- `PwaUpdater` only prompts on genuine updates (controller existed at load).
- Menu panel scrolls within the viewport with dock clearance.

### 11.0.4 — floating cart and fixed chrome
- `FloatingCart` shows across the customer app after a cart item exists.
- Header is sticky at every breakpoint; six-tab dock remains fixed.
- Viewport zoom locked and iOS gesture zoom prevented; maps keep their own gestures.
- PWA update prompt retained.

### 11.0.3 — iOS PWA splash and update prompt
- Splash replays on foreground resume after 3 seconds away.
- Added modern iPhone startup images.
- PwaUpdater prompts when a new service worker is ready.
- Service worker accepts `SKIP_WAITING` messages and announces activation.

### 11.0.2 — splash on every launch
- Removed the sessionStorage guard; splash runs on every full load/reload.
- Internal navigation remains splash-free.
- Reduced-motion skip preserved.

### 11.0.1 — launch splash and cache refresh
- `src/components/splash-intro.tsx` and splash CSS: first-open-per-session
  animation, skip, reduced-motion handling, scroll lock.
- Inline head guard prevents splash flash for returning sessions.
- iOS startup images generated in `public/splash`; metadata links added.
- `public/sw.js` versioned activation clears old `wassl-*` caches and messages
  clients.
- Playwright uses reduced motion to keep tests deterministic.

### 11.0.0 — the super-app release
- Express parcel vertical, local services marketplace, business wholesale and
  Taxi 2.0 core.
- Club referrals/birthday/achievements, merchant/admin insights, admin alerts.
- Unified navigation for all first-class services; six-tab mobile dock.
- Production release prepared after 124 unit tests and 23 Playwright tests.

### 11.0.0-alpha.6 — Express, referrals, insights and alerts
- `ParcelDelivery` model, `src/lib/express.ts` pricing/transitions, DB functions
  and `/api/express` routes for booking, quoting, status, assignment and tracking.
- `/express`, `/express/[id]`, `/driver/express`, `/admin/express`; pickup and
  delivery codes are stripped from driver payloads.
- Express service is enabled by default for live cities with a one-time
  `servicesVersion` migration; operators can still disable it per city.
- Loyalty referrals (`claimLoyaltyReferral`) and yearly birthday rewards, with
  dashboard controls.
- `/api/ai/insights` for merchant/admin read-only analysis; `/api/ai/chat`
  remains customer-only.
- `src/lib/alerts.ts` and an admin operational-alert panel.
- Added express tests and Playwright parcel handover coverage.

### 11.0.0-alpha.5 — support, ratings and Wassl 11 identity
- `src/lib/ai.ts` calls NVIDIA NIM with `node:https` and IPv4, reads
  `NVIDIA_API_KEY` only on the server, and returns a degraded result when the
  provider is unavailable.
- Chat models (`ChatThread`, `ChatMessage`) plus DB/API access control for
  customers, drivers, merchants and admins. Human replies set `aiEnabled=false`.
- `/api/ai/chat` injects real order/ride/loyalty context and a strict Wassl-only
  prompt; it never exposes handover codes or provider errors.
- Ratings on `Order` and `TaxiRide`, with store/driver averages and duplicate
  guards.
- New `/messages`, `/driver/messages`, `/merchant/messages` and
  `/admin/messages`; entry points on order tracking, taxi, store pages and
  account.
- Original SVG monogram, wordmarks, lockups and app icon; four complete theme
  palettes; semantic tokens; PWA/Capacitor assets regenerated.
- Added `tests/chat.test.ts`, `tests/brand.test.ts`, chat/rating Playwright
  cases and `docs/BRAND-11.md`.

### 11.0.0-alpha.4 — grocery intelligence, promotions and Wassl Club
- `src/lib/grocery-assistant.ts` turns recipes, cheapest requests and usual
  purchases into real product/store lists. `/api/grocery/assistant` and
  `/grocery/assistant` expose an editable list that adds to Wassl Basket.
- `src/lib/grocery-promotions.ts` applies flash, quantity, bulk, scheduled and
  store-wide discounts inside `createOrder`. Product badges appear on the
  grocery storefront. Default offers are seeded; merchant CRUD is not built yet.
- `src/lib/inventory.ts` derives sales velocity, top sellers, slow movers,
  suggested restock and stock movements from real orders/reservations. Admin
  Grocery displays it and can restock with one click.
- `src/lib/loyalty.ts` and the new ledger functions in `db.ts` add Wassl Club:
  accounts, immutable transactions, tier progress, earn on delivery, redeem at
  checkout, cancellation refunds, audited admin adjustments and migration of
  legacy balances. `/account/loyalty` is the customer dashboard.
- Added `tests/grocery-assistant.test.ts`, `tests/grocery-promotions.test.ts`,
  `tests/inventory.test.ts`, `tests/loyalty.test.ts` and Playwright coverage.

### 11.0.0-alpha.3 — Grocery 2.0 basket, barcode and recurring lists
- `src/lib/basket.ts` groups cross-store lines, computes per-store fees/minimums
  and totals, parses untrusted local storage and calculates recurring dates.
- `/grocery/basket` compares products across stores and shows transparent
  splits. `/grocery/basket/checkout` creates one order per store with an
  idempotency key, removes successful groups and keeps failed groups for retry.
- `/grocery/scan` uses `BarcodeDetector` when available with a manual fallback;
  `/api/grocery/barcode` resolves real product/store pairs.
- `ShoppingList.recurring` and `updateShoppingListRecurring()` add weekly/monthly
  frequency, next reminder date and a remind flag. No automatic orders.
- Added `tests/basket.test.ts`, barcode/recurring Playwright cases and the
  Grocery 2.0 routes.

### 11.0.0-alpha.2 — service-level city activation
- `City.services` stores independent flags for restaurant, grocery, taxi,
  express, services and business. `src/lib/city-services.ts` supplies defaults,
  merge and sanitisation helpers.
- `updateCity()` and `/api/admin/cities` accept a partial service patch.
- Admin Cities has a per-city Services dialog. Home doors, header/mobile
  navigation and search service results honour the flags.
- Existing live cities default to restaurant/grocery/taxi on; the new verticals
  default off until an operator enables them.
- Added `tests/city-services.test.ts` and an admin Playwright case.

### 11.0.0-alpha.1 — unified search and personalized home
- `src/lib/search.ts` scores real stores, products, aisle categories, enabled
  services and delivery options with Latin/Arabic normalization and bounded
  Levenshtein typo tolerance.
- `/api/search` and `/search` add grouped results, recent searches, suggestions
  and city filtering. The header exposes search on desktop and mobile.
- `src/lib/personalization.ts` builds a deterministic home feed from the
  customer's recent orders, favourites, popular in-stock products, opening
  hours and Casablanca time of day.
- Store product deep links (`/store/[slug]?product=…`) open the product sheet;
  city and grocery pages accept query/category/filter parameters.
- Added `tests/search.test.ts`, `tests/personalization.test.ts` and two
  Playwright cases. This is Phase 1A only; the 11.0 roadmap continues in
  `docs/WASSL-11-PROGRESS.md`.

### 10.8.0 — grocery back office
- Admin **Stores** tab filters partners into Restaurants, Grocery and Other;
  the add action defaults to the active view and each row can be deleted.
- `/admin/grocery` gains a grocery store manager (`GroceryStoreEditor`) with
  cover upload plus create/edit/delete against `/api/admin/stores`.
- `deleteStoreAdmin()` removes a store and its products, detaches merchant
  accounts, blocks locked stores and refuses while orders are active.
- The customer order list hides Reorder when the source store no longer exists.

### 10.7.0 — photos and GPS
- `Store.image` and `Product.image` fields; `storePhoto()` prefers merchant
  uploads. Product tiles and sheets render images with icon fallbacks.
- Merchant dashboard: cover-photo upload on Store profile, item image in Add
  item and per-row Photo action. Admin store form and menu modal have uploads.
- `src/lib/image-client.ts` resizes uploads to bounded JPEG/PNG data URLs.
- Grocery landing has a “Popular in the aisles” product rail; the cart has a
  minimum-order progress bar. The grocery manager's product modal supports the
  same photo upload as restaurant menu items.
- Checkout and taxi booking use `navigator.geolocation` with explicit errors.
  Driver dashboard auto-starts sharing when coming online; taxi queue has GPS.
- iOS `NSLocationWhenInUseUsageDescription` and Android fine/coarse location
  permissions were already in the native projects.

### 10.6.0 — fleet, signup separation, analytics and access
- Admin Fleet is two side-by-side panels, `DriverPanel` for delivery and taxi,
  each provisioning via `AccountProvisionModal` with a preselected kind.
- `/signup` is customer-only; `/signup/store`, `/signup/driver` and
  `/signup/taxi` reuse `SignupShell`. `/login` remains the single login for
  every role. Driver applications capture `requestedKind` and
  `requestedPlate`; the taxi page preselects kind `taxi` and a car.
- `src/lib/analytics.ts` computes delivery (5 MAD), taxi (2 MAD) and grocery
  (5%) margin, 14-day bars, top stores and signup counts. Admin state now
  includes taxi rides.
- `AccountsManager` has a Grant admin action; `updateUserAccess` refuses to
  remove the last admin.
- Overview adds a Wassl profit KPI.

### 10.5.0 — Aero glass and live branding
- `themeStyle()` turns `PlatformSettings.primaryColor`, `accentColor` and the
  theme preset into inline CSS variables. `:root` and `html.dark` consume
  `--brand-custom*` / `--signal-custom*` with Coastal fallbacks.
- Root layout loads settings, sets the palette before paint, passes
  `BrandProvider` the brand name, Arabic name, logo and default theme.
- Admin Settings gained colour pickers, four presets (Coastal, Aero, Midnight,
  Sand), a logo upload (PNG/JPEG/WebP), a default light/dark selector and the
  Arabic brand name. Saving refreshes the server tree.
- Header, cards, panels, inputs and buttons use translucent Aero gradients,
  inner highlights and layered shadows. The bottom bar is now a floating glass
  dock with an active pill; footer padding was increased to clear it.
- Existing `#0f6e6e` settings are migrated to the Coastal `#0b4a45`.

### 10.4.1 — wassl.shop
- Namecheap BasicDNS now serves `wassl.shop` (`A @ → 141.145.192.23`) and
  `www` (`CNAME → wassl.shop`); the registrar URL redirect was removed.
- Caddy serves both names with a Let's Encrypt certificate and redirects
  `www` to the apex. The old `nip.io` name remains available as a fallback.
- `NEXT_PUBLIC_SITE_URL`, mobile shell URL, App Links, Universal Links, README,
  AGENTS and hosting docs were updated to `https://wassl.shop`.
- Brevo domain authentication for `wassl.shop` is complete (DKIM, Brevo code,
  DMARC). `noreply@wassl.shop` is an active sender, and
  `BREVO_SENDER_EMAIL` now uses it. A delivery test to the operator inbox was
  accepted by Brevo.

### 10.4.0 — handover codes and fleet provisioning
- `Order.deliveryPin` is now generated for every order, not only grocery.
  `updateOrderStatus` requires a matching four-digit proof for non-admin
  completion; transition checks run first so illegal jumps keep their 409.
- `TaxiRide.verificationCode` is generated per ride. `updateTaxiRideStatus`
  takes `proofCode`, rejects completion without it, and stamps `codeVerifiedAt`.
- Driver/merchant order views use `handoverSafeOrderView` or an equivalent API
  projection: they keep `handoverRequired` but never receive the code.
- New `HandoverCode` / `HandoverPrompt` components render four large digit
  tiles and a segmented entry dialog. Used in order tracking, taxi tracking,
  driver dashboard and driver taxi queue.
- `Driver` gains `kind` (`delivery`/`taxi`/`both`) and `photo`; taxi acceptance
  stores `driverPhoto`, vehicle and plate on the ride. Delivery assignment
  excludes taxi-only drivers and vice versa.
- Admin can provision driver accounts (`/api/admin/accounts`): generated
  `@wassl.ma` email + password, active/verified user, linked driver profile,
  vehicle, plate, kind and photo. Store logins are provisioned against existing
  stores; `AccountProvisionModal` shows credentials once.
- Admin menu modal uses the existing admin product APIs to add items and toggle
  availability for any store.
- Home taxi section uses `public/images/taxi/*` and CSS route/ping animations;
  `prefers-reduced-motion` disables them.

### 10.3.3 — self-hosted on OCI
- Fly app and volume retired after the service became unreachable.
- App moved to OCI `instance-20261024-2302`; `/opt/wassl` checkout,
  `/var/lib/wassl` JSON store, `/etc/wassl.env` runtime env.
- `wassl.service` runs Next on `127.0.0.1:3000`; `caddy.service` serves
  `https://wassl.shop` with Let's Encrypt and proxies loopback.
- OCI security list opened for `80`/`443`; no NSG. Host firewalld allows only
  `ssh`, `http`, `https`.
- Mobile shell, App Links, Universal Links, README, AGENTS and
  [docs/HOSTING.md](docs/HOSTING.md) updated to the new host.
- Temporary Cloudflare quick tunnel disabled after direct TLS was verified.

### 10.3.2 — restaurant-first home
- `src/app/page.tsx` reordered: three open, top-rated Dakhla restaurant cards
  (with “All restaurants”), then the grocery feature, all-services index, full
  store directory, cities, business tools, and finally the former hero as a
  closing brand/map section with an `<h2>`.
- `topRestaurants` prefers `getOpenState(store).open`, then rating and review
  count, so the first viewport does not lead with a closed kitchen.
- Directory `initialLimit` reduced to 6; new copy keys added in FR/ES/AR.

### 10.3.1 — navigation and mobile chrome
- Public admin links removed from the mobile menu and footer. Admins use the
  normal `/login` form; `/api/auth/login` already returns `/admin` for the role.
- Mobile top bar now exposes the language switcher (compact `EN` control) and
  theme toggle; the wordmark collapses to the route mark below `sm` so five
  header tools fit at 320px without horizontal overflow.
- Removed the scroll listener that slid the six-tab bottom bar off-screen.
  Body padding was replaced by footer bottom padding so the fixed bar never
  covers the last footer line and no pale strip appears beneath the footer.

### 10.3.0 — editorial design pass
- Home: `StoreBrowser` accepts `initialLimit`; the landing page shows nine
  stores, a counted category rail and a “Show all {count} stores” control while
  city pages keep their full listing. Grocery feature is a two-column photo
  mosaic; service doors are a 2×2 mobile grid with a route rule on hover.
- Account: greeter (`Salam, {name}.`), recent-order list with translated status,
  quick-access tiles, profile panel with initials, city/phone/order counts and
  verification state, plus a quiet sign-out.
- Storefront: sticky mobile aisle rail, single rule under search/filters,
  compact product rows, 44px favourite/add controls, stock copy only for low
  and out states, consistent stock counts.
- Empty states: cart, checkout, order history, taxi history, favourites and
  lists now use one ruled card with an icon chip instead of orphan hairlines.
- Orders: labelled order-code field with a short example, tab-count badges,
  translated status labels and a single-line helper strip instead of three
  identical cards.
- Staff: `StaffHeader` hides the nav row when a workspace has no links; admin
  header shows Overview/Accounts/Grocery/Taxi only, merchant header shows the
  grocery catalog link for grocery stores; the merchant order board, grocery
  manager, dispatch console and driver surfaces were migrated off legacy
  rounded cards and `text-ink/xx` tokens.
- i18n: FR/ES/AR entries added for every new customer string; Arabic display
  leading raised to 1.32 so the first line of large headings is not clipped.
- Validation: `tsc` clean, 69 unit tests, 10 Playwright tests, production build
  clean; TasteCheck gate audit CLEAN on grocery, store, taxi, auth, checkout,
  orders, favourites and lists. The home store-directory grid still reports the
  uniform-card warning; it is accepted because the cards are real, photographic
  store listings rather than a decorative feature grid.

### 10.2.0 — verified email accounts (Brevo OTP)
- `src/lib/email-verification.ts`: HMAC code hashing, 10-minute TTL, five
  attempts, 60s resend cooldown, three sends/10min, email masking, test mode.
- `User.emailVerified`, `emailVerifiedAt`, `emailVerification` challenge added;
  new accounts start `false`, legacy/seed/staff accounts stay verified.
- `issueEmailVerification` / `confirmEmailVerification` in `db.ts` run inside
  `mutate()` and audit without ever recording the code.
- `src/lib/email.ts` now uses Brevo (`BREVO_API_KEY`, `BREVO_SENDER_*`) with a
  branded HTML + text verification email; Resend removed.
- Signup no longer opens a session: it creates the account, issues/sends a code
  and sends the browser to `/verify-email`. Login with an unverified address
  does the same. Sessions are only created after confirmation.
- `/verify-email` screen with segmented inputs, paste, auto-submit, resend
  countdown, masked address and EN/FR/ES/AR copy.
- Removed the unused passwordless `/api/auth/otp/*` routes and `src/lib/otp.ts`;
  `upsertOtpUser` is kept for operations provisioning and tests.
- Tests: 17 OTP/email tests (hash, lifecycle, expiry, attempts, cooldown, rate
  limit, template escaping) and updated signup e2e that completes the code.
- Secrets: `BREVO_API_KEY` and `BREVO_SENDER_EMAIL` are Fly/local env only.
  Never set `WASSL_OTP_TEST_MODE=1` on a public deployment.

### 10.1.0 — Coastal Manifest redesign
- Added `DESIGN-SYSTEM.md` (tokens, type, spacing, components, motion, a11y) and
  rewrote `src/app/globals.css` around it.
- Self-hosted Bricolage Grotesque, Instrument Sans and IBM Plex Sans Arabic in
  `public/fonts`; removed the runtime Google Fonts request and preload the two
  Latin faces.
- Rebuilt the shared shell: new route "W" mark, flat header, six-tab bottom bar,
  flat footer, page header and staff header.
- Customer: home, grocery hall, store/menu, product sheet, cart, unified
  checkout (both flows), orders, tracking, taxi, account, favourites, lists,
  login and signup.
- Operations: KPI tiles replaced with ruled type bands, tinted icon chips
  removed, workspace tabs moved to underlines, table status labels de-cased.
- RTL: numeric runs are bidi-isolated, tabs have short labels, Arabic city names
  in the hero, `dir="auto"` on mixed-language copy.
- Mobile: 16px gutters, 11px minimum text, compact door rows, header scrolls away,
  tab bar hides on scroll-down.
- Ran the taste-skill inspector (1440/768/390). Fixed 4 of 6 failures; the two
  remaining are triaged false positives documented in the release notes.
- Checked at 320/390/768/1440, light/dark, EN/AR; 66 unit + 10 e2e tests pass.

### 10.0.0 — grocery module + repository consolidation
- Grocery data model: `Store.grocery` settings, product SKU/barcode/unit/stock/
  variants, order fulfilment/PIN/loyalty, stock reservations and refund requests;
  lazy backfill in `db-backend.ts` for older documents.
- Customer `/grocery` discovery; grocery storefronts render on the main
  `/store/[slug]` route; checkout is unified at `/checkout`; favourites and
  shopping lists live under `/grocery`.
- Grocery is a bottom-tab feature (Home, Stores, Grocery, Taxi, Orders, Account)
  and shares cart, auth, orders, tracking and notifications with delivery/taxi.
- Vendor `/merchant/grocery` catalog, variants, stock, zones and 24/7 settings.
- Admin `/admin/grocery` inventory/refunds.
- Transactional stock reserve/release/commit; pickup code and delivery PIN proof;
  loyalty earn/redeem; refund restock.
- Tests in `tests/grocery.test.ts`; mobile/RTL/dark mode checks.
- Repository snapshot and docs consolidation (this entry).
- Created the `wassl-v10.0.0` repository snapshot with README and this agent
  guide. Version bumped across package, Android (`10.0.0`, code 6) and iOS
  (`10.0.0`, build 6).

### 3.5.1 — order activity and emoji cleanup
- `/orders` gained **Deliveries / Taxi rides** tabs. Taxi history cards show
  route, status, distance, driver, fare, age and track/view links; empty state
  links to `/taxi`.
- Removed visible emoji in home demo, empty checkout, empty city, driver queue,
  order tracking and admin ratings. Replaced with `ProductTile` / Lucide.
- Version 3.5.1 (Android code 5, iOS build 5).

### 3.5.0 — live activity, notifications, Web Push
- `LiveActivityProvider` polls `/api/orders` and `/api/taxi/rides` for customers
  every 6.5 s (visibility-aware) and exposes active items, notifications and push
  state.
- `OngoingTracker` is a persistent dock: latest activity, progress bar, amount,
  expandable list, minimise-to-pill, hides on the matching tracking page and on
  completion. Store cart bar shifts to `bottom-[196px]` while active.
- `NotificationBell`: unread badge, persisted history (`wassl.notifications.v1`),
  mark-all-read, clear, test, enable alerts.
- Web Push: service worker `public/sw.js`, VAPID (`VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`), `/api/push/public-key`,
  `/api/push/subscribe`, `/api/push/test`; subscriptions in
  `Database.pushSubscriptions`; server send on order creation, order status
  changes and taxi status changes; localized by the saved subscription locale.
- Confetti on delivered/completed, shimmer progress, button press feedback.
- Version 3.5.0 (Android code 4, iOS build 4).

### 3.4.0 — Wassl Taxi + i18n/RTL
- `TaxiRide` model, `requested → accepted → arriving → in_progress → completed`
  state machine, fare = 15 MAD + 5 MAD/km, minimum 25 MAD, haversine distance.
- Customer `/taxi`, map picker, tracking `/taxi/[id]`; driver `/driver/taxi`;
  admin `/admin/taxi`; APIs under `/api/taxi/*`; cash added to driver wallet on
  completion.
- Locale SSR via `wassl.locale` cookie, `LocaleProvider`, `getTranslator()`,
  dictionaries in `src/lib/i18n.ts`; language switcher on customer/auth screens.
- Arabic RTL (`dir=rtl`, Noto Kufi, logical utilities). Back-office labels are
  still mostly English — an explicit known gap.
- Version 3.4.0 (Android code 3, iOS build 3).

### 3.3.0 — real dark mode + Capacitor
- Runtime theme tokens; `bg-white` maps to the themed surface; `text-white`
  migrated to `text-on-dark`; dark bridges for status tones, inputs, scrims.
- `ThemeToggle` persists `wassl.theme`, updates PWA theme-color and native
  status bar; inline FOUC guard in the root layout.
- Capacitor 8 shell, splash/icons, safe areas, offline page, deep links,
  Android back handling, haptics, push token registration and CI workflows.
- Version 3.3.0 (Android code 2, iOS build 2).

### 3.2.3 — admin, add item, mobile fit
- Admin store create/edit and driver activation (`/api/admin/stores`,
  `/api/admin/drivers`), pending-approval banner, account management.
- Merchant Add item modal + `POST /api/products` + `createProduct()` audit entry.
- Merchant menu table replaced by mobile rows; upsell cards fit; `.input` moved
  to `@layer components`; anchor styles to `@layer base`.
- HD store photography; emoji replaced by product icons.

### Earlier (pre-3.2.3)
- Phase 2 order state machine, audit log, locked data adapter, modifiers,
  password auth, customer accounts, admin approval, OTP fallback, promos,
  guest address book, Fly/Docker deployment.

## Deployment notes

- Host: OCI VPS `instance-20261024-2302`, region `eu-paris-1`, public IP
  `141.145.192.23`, private IP `10.0.0.125`.
- Live: <https://wassl.shop>.
- App checkout `/opt/wassl`; JSON data `/var/lib/wassl`; env `/etc/wassl.env`
  (root `600`). The Fly deployment and volume are retired.
- `wassl.service` runs `next start -H 127.0.0.1 -p 3000`; `caddy.service`
  terminates TLS on `80/443` and proxies to loopback.
- OCI VCN default security list allows TCP `22`, `80`, `443`; the VNIC has no
  NSG. Host firewalld allows `ssh`, `http`, `https` only.
- Required secrets: `WASSL_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
  `VAPID_SUBJECT`, `WASSL_ADMIN_EMAIL`, `WASSL_ADMIN_PASSWORD`, plus
  `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`.
- Operator email for v10: `admin@wassl.ma`; password is intentionally not
  committed. Rotate it in `/etc/wassl.env`, then the next sign-in calls
  `ensureBootstrapAdmin()` and applies it.
- Full runbook: [docs/HOSTING.md](docs/HOSTING.md).
- Native push delivery still needs FCM (`google-services.json`) and an APNs key;
  token registration and the server-side device store already exist.
- iOS archives are unsigned in CI; Apple team/certificates are required for
  TestFlight.

## Verification checklist

- `npx tsc --noEmit`
- `npm run build`
- `npx vitest run`
- `PLAYWRIGHT_PORT=3510 npx playwright test`
- Mobile overflow: 320/360/375/414 px, including Arabic RTL.
- Dark mode: home, store, merchant menu, admin, taxi, tracker, bell.
- No visible emoji: `document.body.innerText` regex on key pages.
- Taxi flow: request → accept → arriving → in progress → completed, tracker
  appears/disappears, notification entry created.
