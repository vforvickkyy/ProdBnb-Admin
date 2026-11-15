import { expect, test } from "@playwright/test";
import { hasCredentials, login, openFromNav } from "./helpers";

test.describe("payments", () => {
  test.skip(!hasCredentials, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set.");

  test("list renders; detail page renders, and the Refunds list is reachable", async ({ page }) => {
    await login(page);
    await openFromNav(page, "Payments", "Payments");
    await expect(page).toHaveURL(/\/payments/);

    const table = page.getByRole("table", { name: "Payments" });
    if ((await table.count()) > 0) {
      await table.getByRole("button").first().click();
      await expect(page).toHaveURL(/\/payments\/.+/);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.goBack();
      await expect(page).toHaveURL(/\/payments$/);
    }

    await page.getByRole("link", { name: "View refunds →" }).click();
    await expect(page).toHaveURL(/\/payments\/refunds/);
    await expect(page.getByRole("heading", { name: "Refunds" })).toBeVisible();
  });
});
