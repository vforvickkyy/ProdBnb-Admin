import { expect, test } from "@playwright/test";
import { firstAvailableAction, hasCredentials, login, verifyDialogWithoutConfirming } from "./helpers";

test.describe("users", () => {
  test.skip(!hasCredentials, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set.");

  test("list renders; detail navigation and suspend/restore validation work without confirming", async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: "Users", exact: true }).click();
    await expect(page).toHaveURL(/\/users/);

    const firstView = page.getByRole("link", { name: "View" }).first();
    await page.waitForLoadState("networkidle");
    test.skip((await firstView.count()) === 0, "No users exist on staging to exercise detail navigation.");

    await firstView.click();
    await expect(page).toHaveURL(/\/users\/.+/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const action = await firstAvailableAction(page, [
      { name: "Suspend", requiresReason: true },
      { name: "Restore", requiresReason: false },
    ]);
    if (action) {
      await verifyDialogWithoutConfirming(page, action.name, action.requiresReason);
    }
  });
});
