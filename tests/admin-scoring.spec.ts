import { test, expect } from "@playwright/test";
import { login, freshUserEmail, ADMIN_EMAIL } from "./helpers";

interface Row {
  userId: string;
  name: string | null;
  total: number;
  matchPoints: number;
}

// 1006 England v Portugal is OPEN and has no seeded bets — safe to bet on + score.
const SCORE_FIXTURE = 1006;

test.describe.serial("admin scoring", () => {
  test("admin scores a fixture; bets get scored; re-saving same result is idempotent", async ({
    browser,
  }) => {
    const userEmail = freshUserEmail("scoreuser");

    // --- User places an exact-score bet on the OPEN fixture (England 2 - Portugal 1) ---
    const userCtx = await browser.newContext();
    const userPage = await userCtx.newPage();
    await login(userPage, userEmail);
    const placeRes = await userPage.request.post("/api/bets", {
      data: { fixtureId: SCORE_FIXTURE, outcome: "HOME", predHome: 2, predAway: 1 },
    });
    expect(placeRes.ok()).toBeTruthy();
    // Identify this user's id from the leaderboard.
    const lb0 = (await userPage.request.get("/api/leaderboard").then((r) => r.json())) as Row[];
    const userRow0 = lb0.find((r) => r.name === userEmail.split("@")[0]);
    expect(userRow0, "new user appears on leaderboard").toBeTruthy();
    const userId = userRow0!.userId;

    // --- Admin enters the result via the admin panel UI ---
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await login(adminPage, ADMIN_EMAIL);
    await adminPage.goto("/admin");

    const homeInput = adminPage.getByTestId(`result-home-${SCORE_FIXTURE}`);
    const awayInput = adminPage.getByTestId(`result-away-${SCORE_FIXTURE}`);
    await expect(homeInput).toBeVisible();
    await homeInput.fill("2");
    await awayInput.fill("1");
    await adminPage.getByTestId(`result-save-${SCORE_FIXTURE}`).click();
    await expect(adminPage.getByTestId("toast")).toContainText(/result saved/i);

    // --- Verify via API that the user's bet was scored (exact => 3 points) ---
    const lb1 = (await adminPage.request.get("/api/leaderboard").then((r) => r.json())) as Row[];
    const userRow1 = lb1.find((r) => r.userId === userId)!;
    expect(userRow1.matchPoints - userRow0!.matchPoints).toBe(3);
    const totalAfterFirst = userRow1.total;

    // --- Re-save the SAME result: idempotent, no double-award ---
    await homeInput.fill("2");
    await awayInput.fill("1");
    await adminPage.getByTestId(`result-save-${SCORE_FIXTURE}`).click();
    await expect(adminPage.getByTestId("toast")).toContainText(/result saved/i);

    const lb2 = (await adminPage.request.get("/api/leaderboard").then((r) => r.json())) as Row[];
    const userRow2 = lb2.find((r) => r.userId === userId)!;
    expect(userRow2.total).toBe(totalAfterFirst); // unchanged

    await userCtx.close();
    await adminCtx.close();
  });

  test("admin updates bet_close_before_hours and GET /api/admin/settings reflects it", async ({
    page,
  }) => {
    await login(page, ADMIN_EMAIL);
    await page.goto("/admin");

    const closeInput = page.getByTestId("setting-close-hours");
    await expect(closeInput).toBeVisible();
    // The form's effect re-hydrates the input from the server after each save() reload,
    // so assert the field has settled on the expected value right before clicking save.
    await expect(closeInput).toHaveValue("2"); // seeded default

    // Set to a distinctive value, save, and read back via API.
    await closeInput.fill("3");
    await expect(closeInput).toHaveValue("3");
    await page.getByTestId("settings-save").click();
    await expect(page.getByTestId("toast")).toContainText(/settings saved/i);
    // Wait for the post-save reload to settle the field on the persisted value.
    await expect(closeInput).toHaveValue("3");

    const res = await page.request.get("/api/admin/settings");
    expect(res.ok()).toBeTruthy();
    const settings = await res.json();
    expect(settings.bet_close_before_hours).toBe("3");

    // Restore default so other suites relying on the 2h window stay deterministic.
    await closeInput.fill("2");
    await expect(closeInput).toHaveValue("2");
    await page.getByTestId("settings-save").click();
    await expect(page.getByTestId("toast")).toContainText(/settings saved/i);
    await expect(closeInput).toHaveValue("2");
    const restored = await page.request.get("/api/admin/settings").then((r) => r.json());
    expect(restored.bet_close_before_hours).toBe("2");
  });
});
