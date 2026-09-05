import { expect, test } from "@playwright/test";

/**
 * Runs against a real deployed environment (staging by default -- see
 * playwright.config.ts), the same way Phase 13B's manual staging
 * acceptance did. Requires a real admin account's credentials, provided at
 * run time via environment variables -- never hardcoded, never committed:
 *
 *   E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... npm run test:e2e
 *
 * Skips itself entirely (rather than failing) when those aren't set, so a
 * plain `npm run test:e2e` in an environment without credentials configured
 * doesn't produce a false failure -- this is a deliberate opt-in smoke
 * test, not part of the default fast feedback loop.
 */
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

test.describe("admin login and moderation flow", () => {
  test.skip(!email || !password, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set -- see file header.");

  test("logs in, reaches the dashboard, and every nav destination is reachable", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    for (const label of ["Moderation Queue", "Locations", "Bookings", "Payments", "Users", "Audit Log"]) {
      await page.getByRole("link", { name: label, exact: true }).click();
      await expect(page.locator("main")).not.toContainText("This account does not have admin access.");
    }
  });

  test("a non-admin account is shown the access-denied state, never admin data", async ({ page, context }) => {
    // Intentionally does not attempt to log in as a non-admin here -- doing
    // so would require a second, separately-provisioned test account. The
    // access-denied UI path itself is covered by useAdminGate.test.ts;
    // this file only proves the real deployed login/nav flow for an actual
    // admin, matching Phase 13B's own staging-acceptance scope.
    test.skip(true, "Non-admin denial is covered by useAdminGate.test.ts against a mocked gate, not a second live account here.");
    await context.close();
    await page.close();
  });

  test("logging out returns to the login screen and blocks further navigation", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
