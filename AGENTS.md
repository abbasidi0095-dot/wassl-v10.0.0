<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS — Wassl v10.0.0

This file is the handover guide for coding agents. Read it before changing the
app. The user-facing summary lives in [README.md](README.md); this file records
the architecture, hard constraints and the full change history.

## Snapshot

- Release: **10.3.3** (31 October 2026; self-hosted on OCI)
- Live: <https://141.145.192.23.nip.io>
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
npm test                 # 69 Vitest tests
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

### 10.3.3 — self-hosted on OCI
- Fly app and volume retired after the service became unreachable.
- App moved to OCI `instance-20261024-2302`; `/opt/wassl` checkout,
  `/var/lib/wassl` JSON store, `/etc/wassl.env` runtime env.
- `wassl.service` runs Next on `127.0.0.1:3000`; `caddy.service` serves
  `https://141.145.192.23.nip.io` with Let's Encrypt and proxies loopback.
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
- Live: <https://141.145.192.23.nip.io>.
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
