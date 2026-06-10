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

  test("matchdays returns per-round standings for seeded finished rounds", async ({ page }) => {
    await login(page, freshUserEmail("matchdays"));
    const res = await page.request.get("/api/matchdays");
    expect(res.ok()).toBeTruthy();
    const rounds = (await res.json()) as Array<{ round: string; standings: unknown[] }>;
    expect(Array.isArray(rounds)).toBeTruthy();
    expect(rounds.length).toBeGreaterThan(0); // seeded finished fixtures form rounds
    expect(rounds[0]).toHaveProperty("round");
    expect(rounds[0]).toHaveProperty("standings");
  });
});
