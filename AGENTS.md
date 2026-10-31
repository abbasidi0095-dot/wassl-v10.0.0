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

- Release: **10.0.0** (31 October 2026; grocery module included)
- Live: <https://wassl-34-preview.fly.dev>
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
npm test                 # 60 Vitest tests
npm run test:pg          # Postgres integration tests
npm run build            # production build
PLAYWRIGHT_PORT=3510 npx playwright test   # 9 e2e tests
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
8. Grocery stock is decremented/reserved inside `mutate()` only. Never trust
   client price/stock; use `resolveProductStock` and `groceryFees`. Release on
   cancellation, commit on delivery, restock on refund.
9. Customer-facing strings should go through `t()`; the English string is the
   dictionary key and missing translations fall back safely.
10. Never commit secrets. `WASSL_SECRET`, `VAPID_*`, database URLs and admin
   passwords live in the host environment.

## Change history (newest first)

### 10.0.0 — grocery module + repository consolidation
- Grocery data model: `Store.grocery` settings, product SKU/barcode/unit/stock/
  variants, order fulfilment/PIN/loyalty, stock reservations and refund requests;
  lazy backfill in `db-backend.ts` for older documents.
- Customer `/grocery`, `/grocery/[slug]`, `/grocery/checkout`, favourites and
  shopping lists.
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

- Fly app `wassl-34-preview` (personal org of the token used at release), region
  `cdg`, 1 × shared-cpu-1x/1GB, volume `wassl_data` → `/data`, JSON backend.
- `fly.toml` targets this app; `NEXT_PUBLIC_SITE_URL` is the Fly hostname.
- Required secrets: `WASSL_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
  `VAPID_SUBJECT`, `WASSL_ADMIN_EMAIL`, `WASSL_ADMIN_PASSWORD`.
- Operator email for v10: `admin@wassl.ma`; password is intentionally not
  committed. Rotate with `flyctl secrets set WASSL_ADMIN_PASSWORD=...`; the next
  sign-in calls `ensureBootstrapAdmin()` and applies it.
- The old `wassl-ma` app belongs to another Fly account and is not accessible
  with the release token; do not delete it.
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
