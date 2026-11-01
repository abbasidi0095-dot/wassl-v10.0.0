import { defineConfig, devices } from "@playwright/test";
import os from "node:os";
import path from "node:path";

const dataDir = path.join(os.tmpdir(), "wassl-e2e-data");
const port = process.env.PLAYWRIGHT_PORT || "3100";
const origin = `http://127.0.0.1:${port}`;
// Some long-lived demo hosts only ship an older Chromium build. CI uses the
// Playwright-managed browser; locally you can point at any Chromium binary.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: origin,
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  webServer: {
    // Production build: `next dev` in this environment serves stale chunks and
    // the client never hydrates, so the suite exercises the real artifact.
    command: `rm -rf ${dataDir} && npm run build && npx next start -p ${port}`,
    url: origin,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      WASSL_DATA_DIR: dataDir,
      WASSL_SECRET: "e2e-secret",
      // Playwright cannot read real inboxes, so the OTP send route returns the
      // code in its response when this flag is set.
      WASSL_OTP_TEST_MODE: "1",
      ...(process.env.DATABASE_URL
        ? { DATABASE_URL: process.env.DATABASE_URL }
        : {}),
      ...(process.env.WASSL_DB_STATE_ID
        ? { WASSL_DB_STATE_ID: process.env.WASSL_DB_STATE_ID }
        : {}),
      ...(process.env.WASSL_PG_CACHE_MS
        ? { WASSL_PG_CACHE_MS: process.env.WASSL_PG_CACHE_MS }
        : {}),
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
