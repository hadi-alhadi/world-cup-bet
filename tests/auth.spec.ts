import { test, expect } from "@playwright/test";
import { login, freshUserEmail, ADMIN_EMAIL } from "./helpers";

test.describe("auth & authorization", () => {
  test("unauthenticated visit to /games redirects to /login", async ({ page }) => {
    await page.goto("/games");
    await page.waitForURL("**/login**");
    await expect(page).toHaveURL(/\/login/);
    // Main login is Google-only now; the dev box lives at /dev-login.
    await expect(page.getByTestId("google-signin")).toBeVisible();
    await expect(page.getByTestId("dev-email")).toHaveCount(0);
  });

  test("dev login as a regular user reaches /games", async ({ page }) => {
    await login(page, freshUserEmail());
    await expect(page).toHaveURL(/\/games/);
    await expect(page.getByRole("heading", { name: "Games" })).toBeVisible();
  });

  test("non-admin does NOT see Admin nav link", async ({ page }) => {
    await login(page, freshUserEmail());
    // Nav renders Admin link only for ADMIN role.
    await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
  });

  test("non-admin GET /api/admin/settings returns 403", async ({ page }) => {
    await login(page, freshUserEmail());
    const res = await page.request.get("/api/admin/settings");
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  test("admin sees Admin nav link and can read settings", async ({ page }) => {
    await login(page, ADMIN_EMAIL);
    await expect(page.getByRole("link", { name: "Admin" }).first()).toBeVisible();
    const res = await page.request.get("/api/admin/settings");
    expect(res.status()).toBe(200);
  });
});
