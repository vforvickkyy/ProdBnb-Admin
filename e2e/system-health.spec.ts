import { expect, test } from "@playwright/test";
import { hasCredentials, login } from "./helpers";

test.describe("system health", () => {
  test.skip(!hasCredentials, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set.");

  test("loads with both the Readiness and Configuration sections rendering real values", async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: "System Health", exact: true }).click();
    await expect(page).toHaveURL(/\/system/);

    await expect(page.getByRole("heading", { name: "Backend" })).toBeVisible();
    await expect(page.getByText(/^(Ready|Not Ready)$/)).toBeVisible();

    await expect(page.getByRole("heading", { name: "Configuration" })).toBeVisible();
    await expect(page.getByText("Environment")).toBeVisible();
    await expect(page.getByText("Payment provider")).toBeVisible();
    await expect(page.getByText("Notification provider")).toBeVisible();
    await expect(page.getByText("Media (R2)")).toBeVisible();
  });
});
