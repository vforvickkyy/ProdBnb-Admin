import { expect, test } from "@playwright/test";
import { hasCredentials, login } from "./helpers";

test.describe("bookings", () => {
  test.skip(!hasCredentials, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set.");

  test("list renders; detail page and its Notification delivery section render", async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: "Bookings", exact: true }).click();
    await expect(page).toHaveURL(/\/bookings/);

    // Rows are clickable (role="button" on <tr>, not a "View" link) --
    // scope to this page's Table by its accessible caption to avoid
    // matching Pagination's Previous/Next buttons.
    const table = page.getByRole("table", { name: "Bookings" });
    await page.waitForLoadState("networkidle");
    test.skip((await table.count()) === 0, "No bookings exist on staging to exercise detail navigation.");

    await table.getByRole("button").first().click();
    await expect(page).toHaveURL(/\/bookings\/.+/);
    await expect(page.getByRole("heading", { name: "Notification delivery" })).toBeVisible();
  });
});
