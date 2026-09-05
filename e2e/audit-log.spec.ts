import { expect, test } from "@playwright/test";
import { hasCredentials, login } from "./helpers";

test.describe("audit log", () => {
  test.skip(!hasCredentials, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set.");

  test("page loads and remains functional after applying a filter", async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: "Audit Log", exact: true }).click();
    await expect(page).toHaveURL(/\/audit-log/);
    await expect(page.getByRole("heading", { name: "Audit Log" })).toBeVisible();

    await page.getByRole("combobox", { name: "Filter by target type" }).selectOption("user");

    // "Functional" here means: no error state surfaced, regardless of
    // whether the filtered result set happens to be empty or populated on
    // staging right now -- an empty result is not a failure. Scoped to
    // <main>: Sonner's toast Toaster (mounted once in the root layout,
    // outside AdminShell entirely) keeps its own permanent role="alert"
    // announcer region in the DOM at all times, whether or not a toast is
    // showing -- an unscoped getByRole("alert") matches that unconditionally
    // and would "fail" even when the page is working correctly.
    await expect(page.locator("main").getByRole("alert")).toHaveCount(0);

    // A genuinely valid state is either the filtered table or the real
    // empty-state message -- not merely the absence of an error.
    const table = page.getByRole("table", { name: "Audit log" });
    const emptyState = page.getByText("No audit entries match these filters.");
    await expect(table.or(emptyState)).toBeVisible();
  });
});
