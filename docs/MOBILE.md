# Wassl mobile apps (iOS + Android)

Wassl 10.0.0 ships as a **Capacitor native shell** around the production Next.js
app. The web app stays the single source of truth: the native projects load
`https://wassl-34-preview.fly.dev`, so auth cookies, live order events (SSE), MapLibre
and the admin/merchant dashboards all behave exactly as on the web.

- App ID / bundle ID: `ma.wassl.app`
- Display name: **Wassl**
- Version: `10.0.0` (`versionName` on Android, `MARKETING_VERSION` on iOS)
- Native projects: `android/`, `ios/`
- Bundled offline fallback: `mobile/www/offline.html`
- Config: `capacitor.config.ts`

The app is server-rendered, so it is intentionally **not** a static export.
Point the shell at staging with `CAPACITOR_SERVER_URL=https://staging.example.com`
before `npx cap sync`.

## Prerequisites

| Platform | Tooling |
| --- | --- |
| Android | Android Studio (latest), JDK 21, Android SDK 35 |
| iOS | macOS + Xcode 16+, Apple Developer Program membership |
| Both | Node 22, CocoaPods is **not** required (Capacitor 8 uses Swift Package Manager) |

## Everyday commands

```bash
npm install
npm run mobile:sync          # copy offline page + plugins into both projects
npm run mobile:android       # open android/ in Android Studio
npm run mobile:ios           # open ios/ in Xcode
npm run mobile:run:android   # build + install on a connected device/emulator
npm run mobile:run:ios       # build + run in the iOS simulator
```

The production URL is compiled into `capacitor.config.ts` at sync time. After
changing it, re-run `npm run mobile:sync` and rebuild the native app. For a plain
HTTP staging server set `CAPACITOR_CLEARTEXT=1` as well (never for production).

## Android

```bash
npm run mobile:sync
cd android
./gradlew assembleDebug              # debug APK
./gradlew bundleRelease              # AAB for Play Console
```

Or, from the repository root: `npm run mobile:apk` / `npm run mobile:aab`.

Release signing reads environment variables, so no secrets live in the repo:

```bash
export WASSL_KEYSTORE_PATH=/secure/wassl-release.keystore
export WASSL_KEYSTORE_PASSWORD=...
export WASSL_KEY_ALIAS=wassl
export WASSL_KEY_PASSWORD=...
cd android && ./gradlew bundleRelease
```

Create the keystore once (keep it and its passwords in a password manager):

```bash
keytool -genkeypair -v -keystore wassl-release.keystore \
  -alias wassl -keyalg RSA -keysize 2048 -validity 10000
```

Upload the `.aab` to Play Console → Internal testing, then promote to
production. The CI workflow signs automatically when these repository secrets
exist: `WASSL_KEYSTORE_BASE64`, `WASSL_KEYSTORE_PASSWORD`, `WASSL_KEY_ALIAS`,
`WASSL_KEY_PASSWORD`.

## iOS

```bash
npm run mobile:sync
npm run mobile:ios
```

In Xcode:

1. Select the **App** target → *Signing & Capabilities*.
2. Choose your Apple Developer team; `ma.wassl.app` must be a registered App ID.
3. Confirm the **Push Notifications** and **Associated Domains** capabilities
   (`ios/App/App/App.entitlements` already contains them).
4. *Product → Archive* → *Distribute App* → TestFlight / App Store.

Set `DEVELOPMENT_TEAM` (or pick the team in Xcode) before archiving. No Podfile
is required; Swift Package Manager resolves Capacitor and the plugins.

## Deep links

| Platform | File | Served by |
| --- | --- | --- |
| Android | `/.well-known/assetlinks.json` | `src/app/api/well-known/assetlinks/route.ts` |
| iOS | `/.well-known/apple-app-site-association` | `src/app/api/well-known/aasa/route.ts` |

Set these on the production host (Fly secrets):

```bash
fly secrets set APPLE_TEAM_ID=ABCDE12345
fly secrets set ANDROID_APP_CERT_SHA256="AA:BB:...:FF,11:22:...:EE"
```

`ANDROID_APP_CERT_SHA256` accepts a comma-separated list (upload key + Play App
Signing key). Deep links supported today:

- `https://wassl-34-preview.fly.dev/orders/<id>` (verified App Link / Universal Link)
- `wassl://orders/<id>` (custom scheme)

`NativeShell` routes both forms inside the app, and Android's back button
returns through history before minimising the app.

## Push notifications

### Web Push (browser + installed PWA)
- `public/sw.js` handles push + notification clicks.
- `src/lib/push.ts` sends via VAPID; configure `VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` on the host.
- Subscriptions are stored in `Database.pushSubscriptions` and matched by
  customer email (orders) or user id (taxi rides).
- iPhone/iPad: Web Push requires adding the PWA to the Home Screen on iOS 16.4+
  and granting notifications; Safari tabs do not receive background push.

### Native push

The shell asks signed-in users once per install and registers the device token
via `POST /api/devices`; tokens are stored in `Database.devices` (see
`registerDevice` in `src/lib/db.ts`).

To actually deliver notifications:

1. **Android**: create a Firebase project, add an Android app with package
   `ma.wassl.app`, download `google-services.json` into `android/app/`. Gradle
   applies the Google Services plugin automatically when the file exists.
2. **iOS**: create an APNs key in Apple Developer, upload it to Firebase, and
   enable Push Notifications for the App ID. Add `GoogleService-Info.plist` to
   the Xcode project if you use Firebase.
3. Add a sender (FCM HTTP v1 / APNs) on the server that reads tokens from
   `Database.devices` when order status changes. The existing
   `notifyOrderStatusChange` hook in `src/lib/db.ts` is the right place.

Without credentials the app still works; push registration simply stays idle.

## Native behaviour included

- Edge-to-edge safe areas for notches and the home indicator
  (`viewport-fit=cover` + `env(safe-area-inset-*)`).
- Light/dark theme toggle in the customer and staff headers: follows the device
  preference on first launch, persists in `localStorage`, updates the PWA
  `theme-color` and the native status bar.
- Native splash screen and generated app icons
  (`assets/` → `npx capacitor-assets generate`).
- Branded offline page with retry (bundled, shown by `server.errorPath`).
- Status bar styled to the cream/teal palette.
- Offline banner while the connection drops.
- Deep links and Android hardware back-button handling.
- Light haptic feedback on add-to-cart.
- Push permission + token registration.
- Root/site `viewport` locked to `100dvh`-safe layout; no page-level horizontal
  overflow at 320–414 px.

## CI

`.github/workflows/mobile.yml` builds on demand or on `v*` tags:

- **Android** (ubuntu): syncs Capacitor, builds a signed `.aab` when the signing
  secrets exist, otherwise a debug APK. Artifacts are uploaded.
- **iOS** (macos-14): syncs Capacitor and produces an unsigned
  `Wassl.xcarchive` artifact. Signing/TestFlight upload is done locally or by
  adding your distribution certificate to CI.

## Store notes

- Apple review guideline **4.2 (minimum functionality)** rejects thin website
  wrappers. This build adds native push, deep links, offline handling, safe-area
  layout and back-button behaviour. Before submitting, make sure push actually
  delivers order updates — that is the strongest native value for a delivery app.
- **Cash on delivery** must be explained in the App Store description and review
  notes: no in-app payment is collected, so no IAP is required.
- Privacy labels: location (driver live tracking / nearby stores), account
  contact details, order history. No advertising SDKs or cross-app tracking.
- Google Play: complete the Data safety form with the same mapping and provide
  a privacy policy URL.
- Use **Internal testing** (Play) and **TestFlight** (iOS) for the first builds.
