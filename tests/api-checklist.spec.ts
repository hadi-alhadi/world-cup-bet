import { test, expect } from "@playwright/test";
import { login, freshUserEmail, ADMIN_EMAIL } from "./helpers";

test.describe("API checklist", () => {
  test("scoring math reflected in seeded bets (exact=3, outcome-only=1, wrong=0)", async ({
    page,
  }) => {
    // Read the seeded users' scored bets via the leaderboard (admin sees all rows).
    await login(page, ADMIN_EMAIL);
    const rows = (await page.request.get("/api/leaderboard").then((r) => r.json())) as Array<{
      name: string | null;
      matchPoints: number;
    }>;
    const byName = (n: string) => rows.find((r) => r.name === n);
    // Alex: exact(3) + outcome(1) = 4. Sam: wrong(0) + exact-draw(3) = 3.
    expect(byName("Alex")?.matchPoints).toBe(4);
    expect(byName("Sam")?.matchPoints).toBe(3);
  });

  test("admin's own bets/me shows the exact-score scoring rule (1 vs 3 vs 0)", async ({ page }) => {
    await login(page, ADMIN_EMAIL);
    const bets = (await page.request.get("/api/bets/me").then((r) => r.json())) as Array<{
      fixtureId: number;
      points: number | null;
      predHome: number;
      predAway: number;
      outcome: string;
    }>;
    // Seed admin: fx1000 HOME 1-0 (actual 2-1) => outcome only = 1; fx1001 HOME 2-0 (actual 0-0 DRAW) => wrong = 0.
    const b1000 = bets.find((b) => b.fixtureId === 1000);
    const b1001 = bets.find((b) => b.fixtureId === 1001);
    expect(b1000?.points).toBe(1);
    expect(b1001?.points).toBe(0);
  });

  const ADMIN_ROUTES: Array<{ method: "GET" | "POST" | "PUT"; path: string; data?: object }> = [
    { method: "GET", path: "/api/admin/settings" },
    { method: "PUT", path: "/api/admin/settings", data: { betCloseBeforeHours: 2 } },
    { method: "POST", path: "/api/admin/results", data: { fixtureId: 1000, homeScore: 2, awayScore: 1 } },
    { method: "POST", path: "/api/admin/tournament-winner", data: { teamId: 100 } },
  ];

  for (const route of ADMIN_ROUTES) {
    test(`non-admin gets 403 on ${route.method} ${route.path}`, async ({ page }) => {
      await login(page, freshUserEmail());
      const res =
        route.method === "GET"
          ? await page.request.get(route.path)
          : route.method === "PUT"
            ? await page.request.put(route.path, { data: route.data })
            : await page.request.post(route.path, { data: route.data });
      expect(res.status()).toBe(403);
    });
  }

  test("secrets never appear in /games HTML or referenced client JS", async ({ page }) => {
    await login(page, freshUserEmail());

    const htmlRes = await page.request.get("/games");
    const html = await htmlRes.text();
    // Concrete secret VALUES from .env that must never be shipped to the client.
    expect(html).not.toContain("dev-cron-secret"); // CRON_SECRET
    expect(html).not.toContain("dev-secret-only-not-for-production"); // NEXTAUTH_SECRET
    expect(html).not.toContain("THESPORTSDB_KEY");
    expect(html).not.toContain("CRON_SECRET");
    expect(html).not.toContain("NEXTAUTH_SECRET");

    // Scan referenced client JS bundles too.
    const scriptSrcs = Array.from(html.matchAll(/<script[^>]+src="([^"]+)"/g)).map((m) => m[1]);
    for (const src of scriptSrcs) {
      const url = src.startsWith("http") ? src : src;
      const js = await page.request.get(url).then((r) => r.text()).catch(() => "");
      expect(js, `${src} leaks CRON_SECRET`).not.toContain("dev-cron-secret");
      expect(js, `${src} leaks NEXTAUTH_SECRET`).not.toContain(
        "dev-secret-only-not-for-production",
      );
    }
  });
});
