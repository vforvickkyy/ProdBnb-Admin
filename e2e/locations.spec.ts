import { expect, test } from "@playwright/test";
import { firstAvailableAction, hasCredentials, login, openFromNav, verifyDialogWithoutConfirming } from "./helpers";

test.describe("locations", () => {
  test.skip(!hasCredentials, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set.");

  test("list renders; detail navigation and moderation-dialog validation work without confirming", async ({ page }) => {
    await login(page);
    await openFromNav(page, "Listings", "All listings");
    await expect(page).toHaveURL(/\/locations/);

    const firstView = page.getByRole("link", { name: "View", exact: true }).first();
    await page.waitForLoadState("networkidle");
    test.skip((await firstView.count()) === 0, "No locations exist on staging to exercise detail navigation.");

    await firstView.click();
    await expect(page).toHaveURL(/\/locations\/.+/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const action = await firstAvailableAction(page, [
      { name: "Reject", requiresReason: true },
      { name: "Suspend", requiresReason: true },
      { name: "Approve", requiresReason: false },
      { name: "Restore", requiresReason: false },
    ]);
    if (action) {
      await verifyDialogWithoutConfirming(page, action.name, action.requiresReason);
    }
  });
});
