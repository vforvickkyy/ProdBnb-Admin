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
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
