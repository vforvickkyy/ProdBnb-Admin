import { expect, test } from "@playwright/test";
import { hasCredentials, horizontalOverflow, login } from "./helpers";

// Per-test viewport override rather than a second Playwright project --
// this is the only spec that needs a non-desktop viewport (Phase 14-B5).
test.use({ viewport: { width: 390, height: 844 } });

test.describe("responsive (390x844)", () => {
  test.skip(!hasCredentials, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set.");

  test("mobile navigation drawer opens and closes; Dashboard and Users have no horizontal overflow", async ({ page }) => {
    await login(page);

    const menuButton = page.getByRole("button", { name: "Menu" });
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    const drawerNav = page.getByRole("navigation", { name: "Admin sections (mobile menu)" });
    await expect(drawerNav).toBeVisible();
    await expect(drawerNav.getByRole("link", { name: "Dashboard" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(drawerNav).toBeHidden();

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);

    await menuButton.click();
    await drawerNav.getByRole("link", { name: "Users", exact: true }).click();
    await expect(page).toHaveURL(/\/users/);

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });
});
