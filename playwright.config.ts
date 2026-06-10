import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config for Privilee Bet.
 * Drives a real Chromium browser against a local Next.js dev server.
 * Run with `npm run test:e2e` (headless) or `npm run test:e2e:ui`.
 */
export default defineConfig({
  testDir: "./tests",
  // Re-seed the dev DB to the deterministic baseline before each run (QA infra only).
  globalSetup: "./tests/global-setup.ts",
  // Serialize: the Next dev server compiles routes on-demand, so many parallel workers
  // hammering uncompiled routes causes cold-compile timeouts. One worker is plenty here
  // (~26s) and fully deterministic.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",

  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Boot the app for the test run. Reuses an already-running dev server locally
  // so you don't pay the cold-start each time; CI always starts a fresh one.
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
