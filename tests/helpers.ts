import { expect, type Page } from "@playwright/test";

export const ADMIN_EMAIL = "ha@privilee.ae";

/**
 * Dev mock login (AUTH_DEV_MODE=true). Navigates to /login, fills the dev-email
 * input with a @privilee.ae address, submits, and waits for the post-login /games page.
 */
export async function login(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByTestId("dev-email").fill(email);
  await page.getByTestId("dev-signin").click();
  // signIn redirects to callbackUrl (/games by default).
  await page.waitForURL("**/games", { timeout: 20_000 });
  await expect(page.getByTestId("sign-out")).toBeVisible();
}

/**
 * Unique-per-run regular user email so tests that mutate state (winner picks,
 * bets) don't collide with each other or with seeded users.
 */
export function freshUserEmail(prefix = "qa"): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${rand}@privilee.ae`;
}
