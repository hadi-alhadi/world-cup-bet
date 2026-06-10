import { test, expect } from "@playwright/test";
import { login, ADMIN_EMAIL } from "./helpers";

interface Row {
  userId: string;
  name: string | null;
  matchPoints: number;
  winnerPoints: number;
  total: number;
  rank: number;
  isMe?: boolean;
}

test.describe("leaderboard", () => {
  test("loads with seeded users ranked; totals non-negative; sorted desc", async ({ page }) => {
    await login(page, ADMIN_EMAIL);
    await page.goto("/leaderboard");

    const res = await page.request.get("/api/leaderboard");
    expect(res.ok()).toBeTruthy();
    const rows = (await res.json()) as Row[];
    expect(rows.length).toBeGreaterThanOrEqual(3); // seeded admin + alex + sam

    // ranks present and ascending; totals non-negative and = match + winner.
    let prevTotal = Infinity;
    rows.forEach((r, i) => {
      expect(r.rank).toBeGreaterThanOrEqual(1);
      expect(r.total).toBeGreaterThanOrEqual(0);
      expect(r.total).toBe(r.matchPoints + r.winnerPoints);
      expect(r.total).toBeLessThanOrEqual(prevTotal); // sorted descending by total
      prevTotal = r.total;
      // rank is 1-indexed and monotonic
      expect(r.rank).toBe(i + 1);
    });
  });

  test("current user row is highlighted (isMe) and rendered", async ({ page }) => {
    await login(page, ADMIN_EMAIL);
    await page.goto("/leaderboard");

    const res = await page.request.get("/api/leaderboard");
    const rows = (await res.json()) as Row[];
    const me = rows.find((r) => r.isMe);
    expect(me, "current user appears in leaderboard with isMe").toBeTruthy();

    // The corresponding UI row exists and shows rank + total.
    const row = page.getByTestId(`leaderboard-row-${me!.userId}`);
    await expect(row).toBeVisible();
    await expect(row).toContainText(String(me!.total));
    await expect(row).toContainText("(you)");
  });

  test("seeded scoring totals match handoff expectations", async ({ page }) => {
    await login(page, ADMIN_EMAIL);
    const res = await page.request.get("/api/leaderboard");
    const rows = (await res.json()) as Row[];
    const byName = (n: string) => rows.find((r) => r.name === n);

    // Seed: Alex exact(3)+outcome(1)=4 ; Sam wrong(0)+exact-draw(3)=3 ; Hadi outcome(1)+wrong(0)=1.
    expect(byName("Alex")?.matchPoints).toBe(4);
    expect(byName("Sam")?.matchPoints).toBe(3);
    expect(byName("Hadi")?.matchPoints).toBe(1);
    // Winner picks not finalized in seed -> 0 champion points for everyone.
    rows.forEach((r) => expect(r.winnerPoints).toBe(0));
  });
});
