import { expect, test } from "@playwright/test";
import { firstAvailableAction, hasCredentials, login, verifyDialogWithoutConfirming } from "./helpers";

test.describe("hosts", () => {
  test.skip(!hasCredentials, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set.");

  test("list renders; detail navigation, locations/bookings sections, and suspend/restore validation work without confirming", async ({
    page,
  }) => {
    await login(page);
    await page.getByRole("link", { name: "Hosts", exact: true }).click();
    await expect(page).toHaveURL(/\/hosts/);

    const firstView = page.getByRole("link", { name: "View" }).first();
    test.skip((await firstView.count()) === 0, "No hosts exist on staging to exercise detail navigation.");

    await firstView.click();
    await expect(page).toHaveURL(/\/hosts\/.+/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Location status breakdown" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Bookings hosted" })).toBeVisible();

    const action = await firstAvailableAction(page, [
      { name: "Suspend", requiresReason: true },
      { name: "Restore", requiresReason: false },
    ]);
    if (action) {
      await verifyDialogWithoutConfirming(page, action.name, action.requiresReason);
    }
  });
});
