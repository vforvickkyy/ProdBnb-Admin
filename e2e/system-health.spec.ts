import { expect, test } from "@playwright/test";
import { hasCredentials, login } from "./helpers";

test.describe("integrations & health", () => {
  test.skip(!hasCredentials, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set.");

  test("shows readiness, deployment and every integration's keys without secret values", async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: "Integrations & Health", exact: true }).click();
    await expect(page).toHaveURL(/\/system/);

    await expect(page.getByRole("heading", { name: "Integrations & health" })).toBeVisible();
    await expect(page.getByText(/^(Ready|Not ready)$/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Deployment" })).toBeVisible();

    for (const name of ["Supabase", "Cloudflare R2", "Cashfree", "Payment webhooks", "Apple Push (APNs)", "Platform rules"]) {
      await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    }
    // Secret rows only ever say "Set · hidden" / "Not set".
    await expect(page.getByText("SUPABASE_SERVICE_ROLE_KEY")).toBeVisible();
    await expect(page.getByText("Set · hidden").first()).toBeVisible();
  });

  test("runs live checks on demand", async ({ page }) => {
    await login(page);
    await page.goto("/system");
    await page.getByRole("button", { name: "Run live checks" }).click();
    await expect(page.getByText(/Live checks ran/)).toBeVisible({ timeout: 20_000 });
  });
});
