import { defineConfig, devices } from "@playwright/test";
import { loadE2EEnv } from "./tests/e2e/helpers/env";

/**
 * Playwright configuration for the PhaseBinder end-to-end suite.
 *
 * The tests drive the real Next.js app against the live Firebase project, so
 * the runner boots `npm run dev` for us (or reuses one you already have
 * running) and points every test at it through `baseURL`.
 *
 * Test credentials and any overrides live in `tests/e2e/.env` (git-ignored).
 * See tests/e2e/README.md for setup.
 */
loadE2EEnv();

const PORT = Number(process.env.E2E_PORT ?? 3000);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  // The whole suite drives one shared Firebase backend whose dashboard surfaces
  // "recent activity" / top-N rollups. Running serially keeps concurrent specs
  // from crowding each other out of those shared lists, which keeps the
  // dashboard assertions deterministic.
  fullyParallel: false,
  workers: 1,
  // Fail the CI build if a `test.only` was accidentally committed.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // The app talks to Firebase over the network; give actions a little headroom.
  timeout: 90_000,
  expect: { timeout: 15_000 },

  // Rich artifacts are the whole point here — screenshots for the dashboard,
  // plus an HTML report and traces to dig into any failure.
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],

  use: {
    baseURL: BASE_URL,
    // Capture a screenshot for every test (pass or fail) and a trace/video on
    // failure so results are easy to showcase and to debug.
    screenshot: "on",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Boot the dev server for the run unless one is already up.
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
