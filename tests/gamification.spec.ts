import { test, expect } from "@playwright/test";
import { login, freshUserEmail } from "./helpers";

// Read-only checks for the Tier-2/3 gamification surface. (Badge-award logic is covered
// end-to-end by scripts/verify-badges.ts; these guard the API/UI contracts.)
test.describe("gamification", () => {
  test("badge wall lists all 5 badges; a fresh user has none earned", async ({ page }) => {
    await login(page, freshUserEmail("badges"));
    const res = await page.request.get("/api/badges/me");
    expect(res.ok()).toBeTruthy();
    const badges = (await res.json()) as { key: string; earned: boolean }[];
    expect(badges.map((b) => b.key).sort()).toEqual(
      ["against_the_odds", "early_bird", "hot_streak", "prophet", "sniper"],
    );
    expect(badges.every((b) => b.earned === false)).toBeTruthy();

    await page.goto("/badges");
    await expect(page.getByTestId("badge-sniper")).toBeVisible();
  });

  test("community picks are hidden while the window is OPEN, revealed once FINISHED", async ({ page }) => {
    await login(page, freshUserEmail("community"));
    const res = await page.request.get("/api/fixtures?filter=all");
    const fixtures = (await res.json()) as Array<{
      status: string;
      window: { reason: string };
      communityPicks: unknown | null;
    }>;
    const open = fixtures.find((f) => f.window.reason === "OPEN");
    const finished = fixtures.find((f) => f.status === "FINISHED");
    expect(open, "an OPEN fixture exists in seed").toBeTruthy();
    expect(finished, "a FINISHED fixture exists in seed").toBeTruthy();
    expect(open!.communityPicks).toBeNull(); // not revealed while bettable
    expect(finished!.communityPicks).not.toBeNull(); // revealed after close
  });

  test("leaderboard round tabs: only started rounds, with top2/bottom2/dice", async ({ page }) => {
    await login(page, freshUserEmail("rounds"));
    const res = await page.request.get("/api/leaderboard/rounds");
    expect(res.ok()).toBeTruthy();
    const rounds = (await res.json()) as Array<{
      roundKey: string;
      finished: boolean;
      top2: Array<{ userId: string }>;
      bottom2: Array<{ userId: string }>;
      dice: { userId: string } | null;
    }>;
    expect(Array.isArray(rounds)).toBeTruthy();
    // Seed: only "Group Stage · Round 1" has started (Round 2 / Quarter-finals are future).
    expect(rounds.length).toBeGreaterThan(0);
    expect(rounds.every((r) => r.roundKey.startsWith("Group Stage · Round 1"))).toBeTruthy();
    for (const r of rounds) {
      expect(r.top2.length).toBeLessThanOrEqual(2);
      expect(r.bottom2.length).toBeLessThanOrEqual(2);
      // Top and bottom never name the same player.
      const top = new Set(r.top2.map((s) => s.userId));
      expect(r.bottom2.some((s) => top.has(s.userId))).toBeFalsy();
    }

    // Tab gating in the UI: Overall + one tab per started round.
    await page.goto("/leaderboard");
    await expect(page.getByTestId("lb-tab-overall")).toBeVisible();
    await expect(page.getByTestId("lb-tab-group-stage-round-1")).toBeVisible();
    // A future round must NOT have a tab.
    await expect(page.getByTestId("lb-tab-group-stage-round-2")).toHaveCount(0);
    await page.getByTestId("lb-tab-group-stage-round-1").click();
    await expect(page.getByTestId("lb-round-group-stage-round-1")).toBeVisible();
  });
});
