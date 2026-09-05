import { defineConfig, devices } from "@playwright/test";

// Runs against a deployed backend/admin URL (staging by default), not a
// locally-spawned server -- this project has no server-side secrets to run
// with anyway, and Phase 13B already established the pattern of testing the
// real deployed stack rather than a local stand-in. Set ADMIN_BASE_URL to
// point elsewhere (e.g. a local `next dev`) when needed.
const baseURL = process.env.ADMIN_BASE_URL ?? "https://prodbnb-admin-staging.vercel.app";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  // Every spec signs in as the same single shared staging admin account
  // (Phase 14-B5) -- fullyParallel:false only serializes tests within one
  // file, but Playwright still runs different spec files concurrently
  // across multiple workers by default. That let several tests log in to
  // the same account at once, and real interference resulted (a detail
  // page reverting to "Checking session...", a nav click timing out) that
  // vanished as soon as the same files ran one at a time. Forcing a single
  // worker makes the whole suite deterministic without needing a second
  // account.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
