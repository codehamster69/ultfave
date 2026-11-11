import { defineConfig, devices } from "@playwright/test";

import { TEST_BASE_URL, TEST_ENV, TEST_HOST, TEST_PORT } from "./tests/e2e/env";

/**
 * Launch-gate browser suite.
 *
 * The suite runs against a real production build (`next build && next start`)
 * bound to `file:test.db`, seeded by `tests/e2e/global-setup.ts`. A dev server
 * is deliberately not used: compiled routes behave like the deployed app, first
 * requests do not pay the on-demand compile cost, and two parallel workers do
 * not race the compiler.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",

  /* Deterministic gate: no retries, no flakes hidden behind re-runs. */
  retries: 0,
  workers: 2,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,

  timeout: 60_000,
  expect: { timeout: 10_000 },

  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }], ["github"]]
    : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: TEST_BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: `npm run build && npx next start -H ${TEST_HOST} -p ${TEST_PORT}`,
    /*
     * `port` instead of `url`: Playwright then only waits for the socket, so it
     * never queries the app while global setup is still migrating the database.
     */
    port: TEST_PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    /* Authoritative env: Next never overrides keys already present here, so the
     * server cannot fall back to `.env.local` (file:local.db). */
    env: TEST_ENV,
    stdout: "pipe",
    stderr: "pipe",
  },
});
