import { Page, expect } from "@playwright/test";

/**
 * Shared across every spec that needs a real admin session -- centralizing
 * this once means a future change to the login form only needs updating
 * here, not in eight separate files (Phase 14-B5).
 */
export const E2E_ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
export const E2E_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
export const hasCredentials = Boolean(E2E_ADMIN_EMAIL && E2E_ADMIN_PASSWORD);

export async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_ADMIN_EMAIL!);
  await page.getByLabel("Password").fill(E2E_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

/**
 * Opens a ConfirmDialog-style destructive/moderation action, exercises its
 * reason-required validation where applicable, then closes it via Escape
 * WITHOUT ever clicking the actual confirm button -- staging data is never
 * mutated by this helper, only the dialog's own client-side validation is
 * verified (Phase 14-B5 smoke suite is explicitly non-destructive).
 */
export async function verifyDialogWithoutConfirming(page: Page, buttonName: string, requiresReason: boolean): Promise<void> {
  await page.getByRole("button", { name: buttonName }).click();
  const dialog = page.getByRole("dialog");
  const confirmButton = dialog.getByRole("button", { name: buttonName });

  if (requiresReason) {
    await expect(confirmButton).toBeDisabled();
    await dialog.getByLabel("Reason").fill("E2E smoke test -- not confirmed");
    await expect(confirmButton).toBeEnabled();
  } else {
    await expect(confirmButton).toBeEnabled();
  }

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
}

/** First matching action button among several possible states, or null if this row/detail offers none right now. */
export async function firstAvailableAction(
  page: Page,
  actions: { name: string; requiresReason: boolean }[]
): Promise<{ name: string; requiresReason: boolean } | null> {
  for (const action of actions) {
    if ((await page.getByRole("button", { name: action.name }).count()) > 0) {
      return action;
    }
  }
  return null;
}

export function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}
