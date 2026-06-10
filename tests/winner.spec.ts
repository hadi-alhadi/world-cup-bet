import { test, expect } from "@playwright/test";
import { login, freshUserEmail } from "./helpers";

test.describe("champion pick", () => {
  test("fresh user picks a champion via UI (confirm dialog) and sees locked view", async ({
    page,
  }) => {
    await login(page, freshUserEmail("winner"));
    await page.goto("/pick-winner");

    // Pick Brazil (team 100).
    await page.getByTestId("winner-team-100").click();
    // Confirm dialog appears.
    const confirm = page.getByTestId("confirm-pick");
    await expect(confirm).toBeVisible();
    await confirm.click();

    await expect(page.getByTestId("toast")).toContainText(/champion/i);
    // Locked view replaces the grid.
    await expect(page.getByTestId("pick-locked")).toBeVisible();
    await expect(page.getByTestId("pick-locked")).toContainText("Brazil");
  });

  test("second POST /api/winner-pick returns 409 ALREADY_PICKED", async ({ page }) => {
    await login(page, freshUserEmail("winner"));

    const first = await page.request.post("/api/winner-pick", { data: { teamId: 101 } });
    expect(first.status()).toBe(201);

    const second = await page.request.post("/api/winner-pick", { data: { teamId: 102 } });
    expect(second.status()).toBe(409);
    expect((await second.json()).error.code).toBe("ALREADY_PICKED");

    // Pick is unchanged (still 101).
    const me = await page.request.get("/api/winner-pick/me");
    const body = (await me.json()) as { team: { id: number } } | null;
    expect(body?.team.id).toBe(101);
  });
});
