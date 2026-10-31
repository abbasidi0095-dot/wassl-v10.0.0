# Wassl — Next Steps

This repository contains the **Wassl** delivery marketplace demo with Phase 2 hardened. The following are the remaining action items to reach a production-ready state.

## 📦 1. Production Database Migration
- [x] Replace `data/db.json` JSON persistence with Postgres/Supabase when `DATABASE_URL` is set
- [x] Keep the `mutate`/`getDb` API surface (now async) and preserve the JSON demo backend
- [x] Add automatic schema creation and first-boot seeding
- [x] Serialise cross-instance writers with a transaction + `SELECT … FOR UPDATE`
- [x] Add Postgres integration tests and a CI service container
- [x] Document the environment in `.env.example`
- [ ] Normalise the `jsonb` document into per-entity tables (orders, stores, products, audit) for reporting and row-level locking
- [ ] Add PostGIS and targeted spatial queries for dispatch / distance pricing
- [ ] Move SSE fan-out to Postgres `LISTEN/NOTIFY` or Supabase Realtime

## 🔐 1a. Authentication & Approval
- [x] Email + password sign-in at `/login` and self-service sign-up at `/signup`
- [x] Customer accounts activate immediately and get `/account` with cross-device order history
- [x] Store-owner and driver accounts stay `pending` until an operator approves them in **Admin → Accounts**
- [x] Approval provisions a storefront or courier profile automatically; rejection blocks the account
- [x] Admin accounts are provisioned only, never self-service (`WASSL_ADMIN_EMAIL` / `WASSL_ADMIN_PASSWORD`)
- [x] Seeded store, driver and customer passwords are backfilled on older databases
- [x] Unused legacy passwordless OTP endpoints removed (2026-10-31)
- [x] Best-effort Supabase profile mirror with a service-role key and `supabase/schema.sql`
- [x] Email verification with Brevo OTP (2026-10-31)
- [ ] Add password reset
- [x] OTP challenges are persisted in the database as HMACs and survive restarts

## 🔌 2. Plug in User-Provided Restaurant APIs
- [x] Brevo transactional email integration ready (set `BREVO_API_KEY` in the deployment secrets)
- [ ] In `src/lib/data-source/marocapis.ts`, replace the mock `normalise()` function with your real provider
- [ ] Update `src/data/restaurants.locked.json` generation (`scripts/import-restaurants.mjs`) to call your API instead of/as well as MarocAPIs
- [ ] Re-run `node --env-file=.env.local scripts/import-restaurants.mjs` to publish a new locked snapshot
- [ ] Commit the new `checksum` so the admin `GET /api/admin/data-source` reports `integrity.ok: true`

## 🛒 3. Real-World Restaurant UX
- [x] **Modifiers & Options** — the locked menu catalog (`menu-catalog.ts`) already has modifier groups; wire these into the `ProductSheet` modal so customers can select spice levels, portions, extras before adding to cart. *Done: the sheet is wired and `/api/orders` now forwards `optionIds`, so the server prices every option.*
- [x] **Dietary tags & filters** — the `StoreCard` and `StoreBrowser` already tag items (Vegetarian, Vegan, Seafood, etc.); add a "Dietary" filter dropdown in the browser. *Done: `getStores` derives per-store dietary tags and the browser has a filter.*
- [x] **Store hours & real-time open/closed** — `src/lib/hours.ts` already computes Casablanca open-state; connect this to the header status dot and the Admin Console "toggle store" flow. *Done: store cards, the open-only filter and the Admin Console now use `getOpenState`.*
- [x] **Reviews & ratings** — the `RestaurantRecord` has `rating`/`reviews` from SerpApi; add a "View on Google Maps" link (`sourceUrl`) to each store card. *Done: every card links to the source listing or its coordinates.*
- [x] **Upsell & Reorder** — the admin console already has an "Upsell" section concept; implement the "Reorder" button on the order history page. *Done: reorder rebuilds the cart, including modifiers.*
- [x] **Promo / Small-order fees** — add a `promoCode` field to the checkout form; validate against a remote promo service or a simple local rules engine. *Done: `src/lib/promos.ts` validates percent, fixed and free-delivery codes on both the client and the server.*
- [x] **Address book** — persist customer addresses in the DB; pre-populate the checkout pin with saved addresses. *Done: guest address book keyed by a random browser token, with saved-address chips at checkout.*

## 🧪 4. Automated e2e Tests
- [x] Add Playwright tests that:
  - Create an order end-to-end (select store → add item with modifiers → checkout → status transitions)
  - Verify the order state machine blocks illegal jumps
  - Check the audit trail entries after each mutation
  - Test the admin Activity tab filters
  *Done: `e2e/customer.spec.ts` and `e2e/staff.spec.ts` (9 tests).*
- [x] Run `npx playwright test` against the running demo. *Done against a local production build in both JSON and Postgres modes; `npm run e2e` is wired into CI. A public tunnel is still useful for stakeholder demos.*

## 🌐 5. Cloudflare / Production Deploy
- [x] Add a production container path (`Dockerfile`, `output: "standalone"`, `docker-compose.yml` with Postgres)
- [x] Add `GET /api/health` for load balancers and container health checks
- [x] Verify the standalone server boots against Postgres and serves `/`, `/city/dakhla` and `/api/health`
- [ ] Deploy to Cloudflare Pages/Workers (OpenNext + external Postgres) or another host
- [ ] Set `WASSL_SECRET`, `NEXT_PUBLIC_SITE_URL`, `MAROCAPIS_API_KEY` and `SERPAPI_API_KEY` as environment secrets
- [ ] Configure the domain, TLS and a public tunnel for stakeholder demos
- [ ] Note: `npm run build` now emits a Node standalone server; static export is not compatible with SSE or the database backend
- [x] Verify `npx tsc --noEmit`, `npm audit`, and the Vitest suite pass on the CI runner. *Done: `.github/workflows/ci.yml` runs typecheck, tests, build and audit on every push.*

## 📄 6. Documentation & Branding
- [x] Update `README.md` with the new Phase 2 features, persistence, data-source locking and how to run the importer
- [x] Replace placeholder asset paths — PNG app icons (192/512/maskable/apple/favicon), manifest and Open Graph metadata now use the Wassl mark
- [x] Add the Arabic tagline `من المتجر إلى بابك.` alongside the English tagline
- [ ] If the user provides custom restaurant photos, add them to `public/assets/` and reference them in the `RestaurantRecord.image` field (currently nullable)

## 📦 7. Optional: Multi-Tenant / White-Label
- [ ] If you ever need to support multiple brands under one codebase, the current code is **single-brand** (Wassl). To extend:
  - Add a `brandId` field to `Store`, `Order`, `User`
  - Route static assets (`/static/`) per brand
  - Extend the `PlatformSettings` admin console to let each brand customize colors, tagline, commission rate
  - The data-source layer is already pluggable — swap the `RestaurantProvider` at runtime

---

### How to publish a new locked snapshot (once data is ready)

```bash
# 1. Ensure .env.local has your API keys
cat > .env.local << 'EOF'
MAROCAPIS_API_KEY=your_key_here
SERPAPI_API_KEY=your_key_here
RESTAURANT_DATA_SOURCE=locked   # or "live" if you want the live provider

## 🚀 3. Fly.io Production Deployment
- [x] Configured `Dockerfile` with unprivileged user drop and `docker-entrypoint.sh` volume ownership fix
- [x] Provisioned 1GB persistent Fly Volume (`wassl_data`) mounted at `/data`
- [x] Created `fly.toml` with HTTPS enforcement, health check probing, and single-machine placement
- [x] Configured Resend email API key, Supabase keys, and production secrets via `fly secrets set`
- [x] Deployed successfully to **https://wassl-34-preview.fly.dev**
