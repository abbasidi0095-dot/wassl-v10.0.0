# Wassl · وصّل — v10.0.0

**From the store to your door. From the curb to your destination.**
**من المتجر إلى بابك، ومن الرصيف إلى وجهتك.**

A web-first delivery, ride-hailing and 24/7 supermarket platform for Morocco,
built around the Southern corridor: **Dakhla, Laâyoune, Boujdour, Esmara and Tarfaya** first, with
every Moroccan city in the directory.

One platform brand, six experiences: **customer storefront**, **Wassl Grocery**,
**Wassl Taxi**, **store dashboard**, **driver app** and **admin dispatch console**. Cash on
delivery and cash fares only. Live order/ride tracking, a persistent activity
dock, web push notifications, four languages (EN/FR/ES/AR) with RTL, and light
and dark themes.

- **Live:** <https://wassl.shop>
- **Repository:** <https://github.com/abbasidi0095-dot/wassl-v10.0.0>
- **Agent guide:** [AGENTS.md](AGENTS.md) — architecture, constraints and the
  complete change history written for future agents.

> This is a working demo environment with a production-ready persistence path. It
> runs on a local JSON store by default and switches to Postgres (including
> Supabase) when `DATABASE_URL` is set. See [Persistence](#persistence) and
> [Production gaps](#production-gaps).

---

---

## Release history

### 10.5.0 — 31 October 2026 — Aero glass and live branding
- The mobile bottom bar is now a floating Aero-glass dock with a highlight,
  blur, active pill and safe-area spacing; the footer reserves its height.
- Headers, cards, panels, inputs, buttons and image tiles carry a restrained
  Aero treatment: translucent surface gradients, inner highlights, layered
  shadows and depth without washing out content.
- Admin Settings can change the global primary and accent colours, choose a
  Coastal / Aero / Midnight / Sand preset, upload a logo mark, set the default
  light/dark preference and edit the Arabic brand name.
- Brand colours are applied as CSS variables from the database at request time;
  logo and wordmark update across the header, footer and auth screens.
- All changes preserve dark mode, RTL and 320px layouts.

### 10.4.1 — 31 October 2026 — wassl.shop
- The app now lives at <https://wassl.shop> with a Let’s Encrypt certificate
  for both `wassl.shop` and `www.wassl.shop`; `www` redirects to the apex.
- The Namecheap A/CNAME records, Caddy site blocks, mobile shell, App Links,
  Universal Links and documentation all point at the new domain.
- Brevo authenticated `wassl.shop` and `noreply@wassl.shop` is the active OTP
  sender; the Gmail sender remains only as a fallback.
- Short link: <https://tinyurl.com/wasslshop>.

### 10.4.0 — 31 October 2026 — handover codes and fleet provisioning
- Every delivery and taxi ride now gets a four-digit handover code. The customer
  sees four large digits; the driver or store must enter them to close the
  delivery/ride. Admins can see the code; driver and merchant views are stripped
  of it server-side.
- Taxi tracking shows the driver’s photo, vehicle and plate after acceptance.
  Driver profiles now support a photo, vehicle type and delivery/taxi/both role.
- Admin can provision driver logins (unique generated email + password), choose
  the vehicle, plate and photo, and create store logins for existing stores.
- Admin store menu editor can add items and toggle availability on the
  merchant’s behalf.
- Home gains a taxi feature with local photography, a moving route animation,
  fare/route/handover proof points and direct booking/driver actions.
- Driver taxi completion uses a focused four-digit entry dialog; order
  completion uses the same handover language and server-side validation.

### 10.3.3 — 31 October 2026 — self-hosted on OCI
- Fly is retired; Wassl runs on the OCI VPS at
  <https://wassl.shop>.
- Next.js binds `127.0.0.1:3000`; Caddy terminates Let's Encrypt TLS on
  `80/443` and proxies to loopback.
- JSON data lives on the persistent `/var/lib/wassl` volume; systemd units
  restart both services on boot.
- Mobile shell, App Links, Universal Links and all documentation now point at
  the new host. See [docs/HOSTING.md](docs/HOSTING.md).

### 10.3.2 — 31 October 2026 — restaurant-first home
- Home now opens with three open, top-rated Dakhla restaurants and an “All
  restaurants” action. The grocery feature follows, then the all-services index,
  the full store directory, cities, business tools and finally the brand/map
  section that used to sit at the top.
- The closing brand section keeps the live map and operating stats but no longer
  acts as a gate before the first order.
- Restaurant picks prefer stores that are open right now, then rating/reviews.
- Home’s full directory starts at six cards to keep the longer page manageable.

### 10.3.1 — 31 October 2026 — navigation fixes
- Removed the public admin entry from the mobile menu and footer; operations
  accounts now sign in only through the normal `/login` form and are routed to
  `/admin` by role (verified end to end).
- Language and theme controls now sit in the mobile top bar instead of being
  hidden behind the menu. The compact mark keeps the bar within 320px.
- The bottom tab bar no longer hides on scroll; it stays fixed and the footer
  reserves its height so the last line is never covered.

### 10.3.0 — 31 October 2026 — editorial pass
- Home shows a curated nine-store directory with a counted category rail and a
  “Show all” expansion instead of dumping all 43 stores at once.
- Grocery feature rebuilt as a two-column photo mosaic; hero type and stats were
  tightened on mobile and the live map panel kept as the only right-column card.
- Account rebuilt around a greeter, recent orders, quick access and a compact
  profile panel with verification state; cart, checkout and order-history empty
  states now use the same single ruled card.
- Storefront mobile gets a sticky aisle rail, compact product rows, 44px stock
  controls and low/out stock labels only; desktop menu and grocery storefront
  share one border treatment.
- Merchant dashboard, grocery manager, dispatch console and driver surfaces
  moved off legacy rounded cards and `text-ink/xx` tokens onto the Coastal
  Manifest system; staff navigation is consolidated to one row per workspace.
- Order-code search has a real label and example, tab counts are badges, and
  order/taxi history cards carry translated status labels.
- FR/ES/AR copy added for every new customer string; Arabic display leading was
  increased so large headings no longer clip their ascenders.
- Verified: 69 unit tests, 10 Playwright e2e, `tsc` and production build clean;
  TasteCheck gate audit CLEAN on grocery, store, taxi, auth, checkout, orders,
  favourites and lists (home's store directory grid is accepted as content, not
  a generic feature grid).

### 10.2.0 — 31 October 2026 — verified email accounts (Brevo OTP)
- New self-service accounts must confirm a six-digit code before a session is
  opened; password sign-in for an unverified address sends a fresh code.
- Brevo transactional delivery replaces Resend; branded HTML + plain-text email
  with a 10-minute code, single use and no stored plaintext.
- HMAC-hashed challenges, five-attempt limit, 60-second resend cooldown and
  three sends per ten minutes, all inside the serialized database mutation.
- `/verify-email` screen with segmented code input, paste, auto-submit, resend
  countdown, masked address and EN/FR/ES/AR copy.
- Seeded/demo and operations-provisioned accounts remain verified; the unused
  passwordless OTP login routes were removed (no UI used them).

### 10.1.0 — 31 October 2026 — "Coastal Manifest" redesign
- New art direction and design system: Bricolage Grotesque + Instrument Sans +
  IBM Plex Sans Arabic (self-hosted), limestone paper, Atlantic ink, one saffron
  signal, tone-based surfaces, 6/10/16px radii, no glass or gradient washes.
- Rebuilt customer surfaces: home, grocery hall, store and menu, cart, unified
  checkout, orders, live tracking, taxi, account, favourites, lists and auth.
- Rebuilt operational surfaces on one staff language: quiet KPI bands, ruled
  tables and underlined workspace navigation for merchant, driver and admin.
- Full RTL and dark-mode pass with numeric bidi isolation, shorter tab labels,
  contrast-checked tokens (AA on all text pairs) and 320px support.
- Product/hero imagery uses the existing real store photography; no placeholder
  stock or emoji introduced.

### 10.0.0 — 31 October 2026 — grocery module + consolidated release
- **Wassl Grocery**: dedicated supermarket discovery and storefronts, aisles,
  search, variants, SKU/barcode, stock badges and favourites.
- Vendor catalog & stock workspace: product CRUD, variants, SKU/barcode, units,
  low-stock alerts, delivery zones, express/pickup, night pricing, 24/7 and
  overnight-staffing settings.
- Grocery checkout: delivery or pickup, express, scheduled windows, substitution
  preference, loyalty redemption, promo codes and cash payment.
- Transactional stock reservations/release/commit, low-stock admin view, refund
  requests with optional restock, pickup codes and delivery PIN proof.
- Admin grocery operations, inventory metrics and refund queue.
- New public repository snapshot containing the full platform.
- Customer delivery and **Wassl Taxi** in one app, with persistent live tracking,
  web push notifications, in-app notification centre and cash settlement.
- Four-language UI (English, French, Spanish, Arabic) with RTL layout.
- Light/dark themes, Capacitor iOS/Android shells, Fly deployment and CI builds.
- Operator credentials moved to `admin@wassl.ma` (see the deployment secrets
  for the current password).

### 3.5.1 — order activity & emoji cleanup
- Orders page split into **Deliveries** and **Taxi rides** tabs with counts,
  route/status/fare/driver history and a direct track/view link.
- Removed every visible emoji: home order demo, empty checkout, empty city,
  driver/tracking states and admin rating stars now use Lucide icons or
  `ProductTile`. Verified no visible emoji on customer/staff pages.
- Version bumps for Android (code 5) and iOS (build 5).

### 3.5.0 — live activity + notifications
- Persistent **ongoing tracker** for active orders and taxi rides: live progress,
  amount, age, expandable multi-activity list, minimise-to-pill, auto-hide on the
  tracking page or on completion; cart bar moves up while it is visible.
- **Notification centre** with unread badge, persisted history, mark-all-read,
  clear, test and enable-alerts actions.
- **Web Push**: `public/sw.js`, VAPID keys, `/api/push/*`, subscriptions stored in
  `Database.pushSubscriptions`, localized push on order creation/status changes
  and taxi status changes.
- Confetti on delivery/completion, shimmer progress, press feedback, live pulses.
- Version 3.5.0 (Android code 4, iOS build 4).

### 3.4.0 — Wassl Taxi + four languages
- Ride-hailing vertical: customer request with map pickup/drop-off, haversine
  distance and transparent fare, tracking timeline, driver queue and admin
  operations table; cash added to the driver wallet.
- SSR locale provider backed by the `wassl.locale` cookie; EN/FR/ES/AR
  dictionaries; language switcher on customer/auth screens.
- Arabic RTL: `dir=rtl`, Noto Kufi Arabic, corrected typography, logical
  `ms/me/ps/pe/start/end` and `text-start/end` utilities across the app.
- Version 3.4.0 (Android code 3, iOS build 3).

### 3.3.0 — real dark mode + native shell
- Runtime theme tokens, `html.dark` palette, dark bridges for cards/inputs/
  status tones, FOUC guard, theme toggle in customer and staff headers,
  `localStorage` persistence, PWA theme colour and native status-bar sync.
- Capacitor iOS/Android shell: app ID `ma.wassl.app`, splash/icons, safe-area
  layout, offline fallback, deep-link files, Android back handling, haptics,
  push token registration, CI workflows.
- Version 3.3.0 (Android code 2, iOS build 2).

### 3.2.3 — admin, add-item and mobile fit
- Admin store create/edit, driver approval/activation, accounts pending banner
  and new `/api/admin/stores` + `/api/admin/drivers` endpoints.
- Merchant **Add item** flow (`POST /api/products`, `createProduct`, audit log)
  and responsive menu rows replacing the overflowing table.
- Storefront upsell cards fit mobile, `.input` moved to `@layer components`, and
  anchor styles moved to `@layer base` to fix Tailwind overrides.
- HD store photography and the first mobile overflow pass.

---

## Quick start

```bash
cd wassl-v10.0.0
npm install
npm run dev          # http://localhost:3000
npm test             # Vitest unit + integration tests
npm run test:pg      # Postgres backend tests (needs TEST_DATABASE_URL)
npm run typecheck    # tsc --noEmit
```

Production build:

```bash
npm run build
npm start            # defaults to :3000, use PORT=3100 npm start to change
```

Requirements: Node 22+, npm 10+. No Docker or external services are needed for
the demo. A Postgres database is optional and only required when you want the
production persistence path.

### Environment variables

Copy `.env.example` to `.env.local` for a documented template.

| Variable | Default | Purpose |
|---|---|---|
| `WASSL_SECRET` | dev fallback string | HMAC secret for session cookies — **set this in production** |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Public origin for canonical URLs and Open Graph metadata |
| `DATABASE_URL` | unset | Postgres/Supabase connection string. When set, the app uses the Postgres backend |
| `DATABASE_SSL` | unset | `true` or `no-verify` for hosted databases with TLS |
| `WASSL_DB` | automatic | Set to `json` to force the demo backend even when `DATABASE_URL` exists |
| `WASSL_DB_STATE_ID` | `platform` | Row key for the document; useful for tests or multiple environments in one database |
| `WASSL_PG_POOL_MAX` | `5` | Postgres connection pool size |
| `WASSL_PG_CACHE_MS` | `0` | Read-cache TTL in milliseconds; `0` always reads the latest committed row |
| `WASSL_DATA_DIR` | `./data` | Directory for the JSON database |
| `PORT` | `3000` | Server port |
| `WASSL_ADMIN_EMAIL` | `admin@wassl.ma` | Provisioned operations account, created on first login |
| `WASSL_ADMIN_PASSWORD` | demo fallback | Rotates the operator password on the next sign-in |
| `WASSL_DEMO_STORE_PASSWORD` | demo fallback | Password for the seeded store accounts |
| `WASSL_DEMO_DRIVER_PASSWORD` | demo fallback | Password for the seeded driver accounts |
| `WASSL_DEMO_CUSTOMER_PASSWORD` | demo fallback | Password for the seeded customer account |
| `BREVO_API_KEY` | unset | Brevo transactional email key for verification and receipts |
| `BREVO_SENDER_EMAIL` | `abbasidi0095@gmail.com` | Verified Brevo sender address |
| `BREVO_SENDER_NAME` | `Wassl` | Sender display name |
| `BREVO_REPLY_TO` | unset | Optional reply-to address |
| `WASSL_ADMIN_EMAILS` | `admin@wassl.ma` | Extra addresses allowed to claim the admin role through the staff flow |
| `NEXT_PUBLIC_SUPABASE_URL` | provided project | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | provided key | Public Supabase key (safe in the browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | unset | Server-only key that lets the app mirror profiles into Supabase |
| `MAROCAPIS_API_KEY` | unset | Restaurant directory importer / live provider |
| `SERPAPI_API_KEY` | unset | Ratings, reviews, hours and address enrichment |

The JSON database is created on first request at `data/db.json` and is
gitignored. Reset it from the admin console or by deleting the file.

### Persistence

Two drivers implement the same API in `src/lib/db.ts`:

- **JSON** (default) — zero-config demo store with atomic file writes.
- **Postgres** — selected automatically when `DATABASE_URL` is set. The schema is
  created on first use:

  ```sql
  CREATE TABLE IF NOT EXISTS wassl_state (
    id text PRIMARY KEY,
    data jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  ```

  Every mutation runs inside a transaction and takes `SELECT … FOR UPDATE` on the
  document row, so concurrent app instances queue instead of losing writes. A
  failed mutation rolls back and never publishes an SSE event. The seed data from
  `src/lib/seed.ts` is inserted on first boot.

  ```bash
  DATABASE_URL='postgresql://user:pass@host:5432/wassl' \
  DATABASE_SSL=no-verify \
  npm run dev
  ```

This keeps the demo model (`getDb` / `mutate`) intact while removing the unsafe
single-process JSON writer from the production path. A future step is to
normalise the document into per-entity tables for reporting and row-level
locking; see [NEXT_STEPS.md](NEXT_STEPS.md).

### Docker / self-hosted deploy

The repository ships a multi-stage `Dockerfile` (Next.js standalone output) and a
`docker-compose.yml` with Postgres 16:

```bash
cp .env.example .env
# edit .env: WASSL_SECRET, POSTGRES_PASSWORD, NEXT_PUBLIC_SITE_URL
docker compose up -d --build
curl http://localhost:3000/api/health
```

The Postgres volume (`wassl-pgdata`) survives container restarts. The schema and
seed are created on the first request. `GET /api/health` reports the active
backend and collection counts and is used by the container health check.

For Cloudflare Pages/Workers, use a Node runtime adapter (OpenNext) and an
external Postgres/Supabase database; static export is not compatible with the
SSE stream or the file-backed demo.

---

## Seeded accounts

The seed creates sample stores, drivers and accounts so the marketplace has
data on first boot. All seeded accounts use passwords; the operator and demo
passwords are set through the environment variables above or fall back to the
deployment defaults in `src/lib/auth-config.ts`.

| Workspace | Email | Notes |
|---|---|---|
| Operations | `admin@wassl.ma` | Provisioned only — never self-service |
| Store owner | `store@wassl.ma` | Dakhla Grill, active |
| Store owner | `sahara@wassl.ma` | Sahara Market, active |
| Store owner | `laayoune@wassl.ma` | Laâyoune Burger, active |
| Driver | `driver@wassl.ma` | Youssef M., active |
| Driver | `driver2@wassl.ma` | Brahim L., active |
| Customer | `customer@wassl.ma` | Demo customer, active |

Change the defaults before a public launch. The operator account is
re-provisioned on the next login when `WASSL_ADMIN_PASSWORD` changes.

Customers can create an account at `/signup`, sign in at `/login`, and see
their order history across devices at `/account`. Guest checkout still works,
and orders remain trackable by code (e.g. `WSL-84F2A1`).

### Promo codes

The local rules engine lives in `src/lib/promos.ts`. The demo ships with:

| Code | Effect | Minimum |
|---|---|---|
| `WASSAL10` | 10% off, capped at 30 MAD | 50 MAD |
| `DAKHLA15` | 15 MAD off, Dakhla only | 80 MAD |
| `FREEDELIVERY` | Delivery fee waived | 60 MAD |

The checkout validates a code for instant feedback, then the order writer
validates it again and stores `promoCode` and `discount` on the order.

### Saved addresses

Checkout keeps a random guest token in `localStorage` and stores up to ten
addresses in the configured database. Signed-in customers also get their name,
phone and email prefilled from their account; saved addresses stay tied to the
device token.

---

## Authentication and approval

Everyone signs in at `/login` with an email and password. New accounts are
created at `/signup`:

1. **Customer** accounts are active immediately and land on `/account`.
2. **Store owner** and **driver** accounts start as `pending`. They can sign in
   and see `/pending`, but their workspace stays locked.
3. **Admin** accounts cannot be self-created. The operator account is
   provisioned from `WASSL_ADMIN_EMAIL` / `WASSL_ADMIN_PASSWORD`.
4. An operator opens **Admin → Accounts**, reviews pending sign-ups, and clicks
   **Approve**. Approval provisions a storefront for a store owner or a courier
   profile for a driver. **Reject** blocks the account.

The legacy email-OTP endpoints remain available for compatibility, but password
sign-in is the primary path and does not depend on Resend. Order-notification
emails still use Resend when configured.

Supabase mirrors verified profiles into its `users` table. Run
`supabase/schema.sql` once, then set `SUPABASE_SERVICE_ROLE_KEY` on the server.
The app database remains the source of truth, so Supabase downtime cannot lock
staff out.

## End-to-end flow

1. **Customer** — pick Dakhla, open *Dakhla Grill*, add items, open the cart,
   place a COD order with a map pin and landmark.
2. **Store** — sign in with email + password, accept, start preparing, mark ready.
   The board updates live and chimes on new orders.
3. **Admin** — sign in with the operator account, find the order, use **Auto** or pick a
   driver, then watch it on the live map.
4. **Driver** — sign in with email + password, go online, pick up, start delivery,
   mark delivered. Cash is added to the driver's COD wallet.
5. **Customer** — the tracking page updates over SSE, showing the driver pin,
   timeline, receipt and cash status.
6. **Admin** — confirm the driver's cash liability and the store payout in
   **Settings → COD reconciliation**.

---

## What is implemented

### Customer
- Home, city pages, all-209-city directory with live/soon status
- Store pages, menu categories, search, sold-out states
- Store cards with live Casablanca opening hours, dietary tags and a Google Maps link
- Dietary filter (Vegetarian, Vegan, Seafood) and open-now filter in the browser
- Cart with per-store minimums and delivery fees
- Product options/modifiers priced on the server, not trusted from the client
- COD checkout: name, phone, address, landmark, notes, ASAP or scheduled slot,
  map pin picker, saved-address chips, promo codes
- Live tracking: SSE updates, timeline, driver card, call/WhatsApp, ETA fallback
- Receipt, cash status, order history, one-click reorder (with modifiers)
- Wassl Taxi: map-based pickup/drop-off, distance and fare estimate, cash ride,
  live status timeline, driver card and trip history
- Wassl Grocery: store discovery, aisles, search, variants, stock, favourites,
  shopping lists, pickup/express/scheduled checkout, loyalty and refunds
- Persistent live tracker dock for active orders and taxi rides (progress bar,
  expandable list, minimise to a floating pill, auto-hides when complete)
- Notification centre with unread badge, in-app history, browser Web Push and
  one-tap test; confetti when an order or ride completes

### Store owner
- Grocery catalog and stock workspace: SKU/barcode, variants, units, low-stock
  alerts, delivery zones, express/pickup, night fees and 24/7 staffing settings
- Live order board with sound toggle and automatic refresh
- Accept / reject / preparing / ready transitions
- Open or pause the store
- Menu stock toggles
- Store profile, commission and weekly settlement estimate
- SSE scoped to the store

### Driver
- Go online/offline
- Assigned active orders and nearby unassigned demand
- Pickup → en route → delivered transitions
- Browser GPS sharing, plus a deterministic route simulator for demos
- COD wallet with cash-on-hand vs cash limit, estimated delivery earnings
- Delivery history
- Taxi queue: accept nearby rides, on-my-way, start and complete trips, cash
  added to the driver wallet

### Admin
- Grocery operations: inventory value, low/out-of-stock, stock adjustment,
  refund approval/rejection/refund with optional restock
- Live operations map with store, driver and customer markers
- Order queue: manual assignment, nearest-driver auto-assign, force status
- Store open/closed control
- Fleet view with COD liability per driver
- City activation for all 209 cities (live / soon)
- Platform settings: brand, tagline, support phone, commission, default fee,
  waitlist toggle
- COD reconciliation summary and one-click demo reset
- Taxi operations: active/completed rides, cash collected, route and status

### Platform
- HMAC-signed, role-scoped session cookies
- Role guards on pages and APIs (merchant ↔ own store, driver ↔ own orders)
- SSE event bus with filters for order, store, city, driver and type
- File-backed JSON persistence with atomic writes
- PWA manifest, theme colour, installable icon, mobile bottom navigation
- Web Push (VAPID + service worker) for order and taxi status, plus in-app
  notifications; native push tokens registered by the Capacitor shell
- English, French, Spanish and Arabic UI with RTL layout and a persisted locale
- Light and dark themes with native status-bar sync in the mobile shells
- Arabic brand and city names, MAD pricing, `+212`, Africa/Casablanca assumptions

---

## Design system

Wassl uses the **Coastal Manifest** design language: an Atlantic port authority's
wayfinding system crossed with a well-set market manifest. Warm limestone paper,
deep green ink, one saffron signal, real photography, tabular figures and
deliberate white space.

- Full tokens, type scale, component anatomy and accessibility rules:
  [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md).
- Fonts are self-hosted WOFF2 in `public/fonts` (no runtime Google request):
  Bricolage Grotesque (display), Instrument Sans (UI), IBM Plex Sans Arabic.
- The visual language is shared by the customer storefront, grocery, taxi,
  merchant workspace, driver app and admin console.

## Grocery module

The grocery module lives alongside restaurants and taxi without replacing them.
See [docs/GROCERY.md](docs/GROCERY.md) for the architecture audit, migration
plan, risk assessment and phase breakdown.

- Customer: `/grocery` discovery, **main `/store/[slug]` storefront** for grocery
  stores, unified `/checkout`, `/grocery/favorites` and `/grocery/lists`.
- Grocery is a first-class bottom-tab feature alongside delivery and taxi; store
  cards, cart, checkout, orders, tracking and notifications are shared.
- Vendor: `/merchant/grocery` catalog, stock, variants and fulfilment settings.
- Admin: `/admin/grocery` inventory health and refunds.
- Data: optional `Store.grocery`, `Product` SKU/barcode/unit/stock/variants,
  `Order` fulfilment/PIN/loyalty fields, `StockReservation` and `RefundRequest`.
  Legacy databases are backfilled lazily and safely.
- Stock is decremented and reserved in the serialized `mutate()` transaction;
  cancellation releases it, delivery commits it, refunds can restock it.

---

## Architecture

```
src/
  app/
    api/
      admin/…             reset, city activation, full state
      auth/…              password login/signup, OTP send/confirm, logout
      verify-email/       six-digit verification screen
      driver/…            location, status
      events/             SSE stream
      merchant/store/     open/closed toggle
      orders/…            create, read, status, assign
      products/[id]/      stock toggle
      settings/           platform settings
    city/[slug]/          city storefront
    cities/               national directory
    store/[slug]/         store + menu
    cart/, checkout/      cart and COD checkout
    orders/, orders/[id]/ history and live tracking
    merchant/             store workspace
    driver/               driver workspace
    admin/                dispatch console
    login/                staff sign-in
  components/             header, footer, maps, cart, cards, staff shell
  data/cities.json        209 Moroccan cities
  lib/
    types.ts              domain model + status labels
    seed.ts               stores, products, drivers, users, demo orders
    db.ts                 public data API and all mutations
    db-backend.ts         JSON and Postgres persistence drivers
    events.ts             in-process event bus with commit-scoped buffering
    security.ts           password hashing, session tokens, IDs
    auth.ts               page guards and request helpers
    api-auth.ts           API role guards
    utils.ts              money, time, distance, formatting
```

**Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind 4,
MapLibre GL 6, lucide-react. OpenStreetMap raster tiles.

**Real-time:** server-side `EventEmitter` → SSE at `/api/events`. Pages also
poll as a safety net (15–20 s). Driver location updates are throttled by the
browser's geolocation `watchPosition`.

### Order state machine

```
placed → accepted → preparing → ready → assigned → picked_up → en_route → delivered
                                 ↘ cancelled
```

- Store: `accepted`, `preparing`, `ready`, `cancelled`
- Driver: `picked_up`, `en_route`, `delivered`
- Admin: any status except `placed`, plus assign / auto-assign
- Delivery sets `cashCollected`, increments the driver's `cashOnHand` and
  `deliveries`, and frees the driver.

### COD ledger rules

- A driver at `cashOnHand >= cashLimit` cannot be assigned new orders.
- Cash collected is tracked separately from delivery earnings.
- Admin sees total cash held by drivers and store payouts due.
- Settlement is modelled as weekly, minus commission.

---

## City strategy

All 209 cities are seeded with Arabic names, coordinates, population and region.
Only five are marked `priority` and initially `live`:

| City | Arabic | Model |
|---|---|---|
| Dakhla | الداخلة | On-demand + scheduled |
| Laâyoune | العيون | On-demand |
| Boujdour | بوجدور | On-demand + scheduled |
| Esmara | السمارة | Scheduled-first |
| Tarfaya | طرفاية | Scheduled-first |

Everything else is `soon`: visible, searchable, and switchable to live from the
admin console when supply exists. Pricing is per store today; zone/distance
pricing is the next step for long empty distances.

---

## Glovo / REA benchmark

REA (`morluto/rea`) was installed and registered for OpenCode, and the
`reverse-engineer-anything` skill is available. The intended analysis was the
**public** Glovo Morocco web flow: city selection, store discovery, menu/cart
structure, checkout fields, status model and tracking cadence.

**This analysis was not completed.** No Chrome/Chromium binary is available in
this environment, so REA's CDP website inspection could not attach to a browser.
The product structure above therefore comes from generally known delivery-app
patterns plus the requirements agreed for Wassl — not from a captured Glovo
session.

Boundaries for when it is run: public pages only, normal navigation, no login
bypass, no private endpoint abuse, no bulk scraping, and no copying of Glovo
code, assets, colours or logo. Findings would be recorded as an original feature
map and wireframes, not as borrowed implementation.

To run it later:

```bash
# install a Chrome-family browser, then
npx rea-agents@latest doctor
# open a normal browsing session and use the REA browser tools through OpenCode
```

---

## Production gaps

This is a demo, deliberately scoped. Before a real pilot:

1. **Database** — the Postgres driver removes the single-process JSON writer
   from the production path, but the document is stored as one `jsonb` row.
   Normalise it into tables (and add PostGIS for geospatial queries) before
   high-volume reporting or sharding. The JSON store remains the demo default.
2. **Auth** — email + password sign-in with operator approval is in place; add
   password reset, session revocation, a distributed rate-limit store
   for multi-instance fallback and persisted rate limits. Rotate `WASSL_SECRET`
   and the seeded credentials before a public launch.
3. **State machine** — enforce legal transitions server-side per role instead of
   allowing admin force-jumps.
4. **Payments/COD** — immutable ledger, shift close, cash handover confirmation,
   store payouts, refunds and disputes.
5. **Realtime** — move SSE to Postgres `LISTEN/NOTIFY`, Supabase Realtime or
   Redis so multiple server instances share events; persist driver locations.
6. **Dispatch** — real road distance/ETA (OSRM/GraphHopper), batching, offers
   with accept/decline timeouts, offline driver queue.
7. **Maps** — replace OSM raster tiles with a licensed provider (MapTiler,
   Protomaps) and add a tile usage policy.
8. **Notifications** — Web Push, WhatsApp templates, SMS fallback.
9. **i18n/RTL** — the UI is English-first with Arabic labels; full Arabic/French
   locales and RTL layout are not done.
10. **Ops** — audit logs, monitoring (Sentry), analytics (PostHog), backups,
    tests (Playwright across all four roles), deployment hardening.
11. **Store onboarding** — documents, verification, hours/holidays, zone editor,
    CSV import, promotions, ratings moderation.

---

## Mobile apps (iOS + Android)

Wassl 10.0.0 ships as a Capacitor native shell around the production Next.js app
(app ID `ma.wassl.app`). The native projects live in `android/` and `ios/`; the
shell loads `https://wassl.shop` so auth, live orders, maps and dashboards
stay identical to the web app. Native additions: splash/icons, safe-area layout,
offline fallback, deep links, Android back handling, haptic add-to-cart, dark
mode with native status-bar sync, and push token registration.

```bash
npm run mobile:sync
npm run mobile:android   # Android Studio
npm run mobile:ios       # Xcode (macOS)
```

Full signing, push credential, deep-link and store-submission instructions are in
[`docs/MOBILE.md`](docs/MOBILE.md). CI builds both platforms from
`.github/workflows/mobile.yml`.

## Verification performed

- `npx tsc --noEmit` — clean
- `npm run build` — clean
- `npm audit` — 0 vulnerabilities
- `npx vitest run` — 71 tests pass (state machine, order lifecycle, password auth,
  account approval, OTP fallback, locked data source, promos, guest address book,
  transactional event batching)
- `npm run test:pg` — 4 Postgres integration tests pass (seed/read, three
  concurrent writers, rollback, durable audit trail)
- Playwright suite (10 tests) covers password sign-in, new-account review and admin
  approval against the production build
- API flow tested against a production build: create order with modifiers and a
  promo → server repriced options and discount → merchant accept/prepare/ready →
  admin assign → driver pickup/en route/delivered → customer sees `cashCollected`
  → driver cash and GMV updated
- Address API tested against a production build: save → list by token → delete
- Role guards tested: unauthenticated staff pages redirect to `/login`; a merchant
  cannot touch another store's order; a driver cannot touch an unassigned order
- All customer and staff pages return 200 with the right session
