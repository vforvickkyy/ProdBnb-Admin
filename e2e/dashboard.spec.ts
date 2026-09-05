import { expect, test } from "@playwright/test";
import { hasCredentials, login } from "./helpers";

test.describe("dashboard", () => {
  test.skip(!hasCredentials, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set.");

  test("loads and renders at least one numeric stat", async ({ page }) => {
    await login(page);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    const totalUsers = page.getByRole("link", { name: /Total users/ });
    await expect(totalUsers).toBeVisible();
    await expect(totalUsers).toContainText(/\d/);
  });
});
