import { test, expect } from "@playwright/test";
import { login, freshUserEmail } from "./helpers";

const OPEN_FIXTURE = 1004; // Brazil v Argentina — OPEN
const CLOSED_FIXTURE = 1003; // Portugal v Netherlands — SCHEDULED but window shut
const NOT_OPEN_FIXTURE = 1007; // Germany v Netherlands — NOT_OPEN_YET
const LIVE_FIXTURE = 1002; // Spain v England — LIVE

/** Locate a fixture card by walking up from its bet-form / locked control. */
async function gotoGamesAll(page: import("@playwright/test").Page) {
  await page.goto("/games");
  await page.getByTestId("filter-all").click();
  await expect(page.getByRole("heading", { name: "Games" })).toBeVisible();
}

test.describe("betting", () => {
  test("server confirms 1004 is bettable and 1003/1007/1002 are not", async ({ page }) => {
    await login(page, freshUserEmail());
    const res = await page.request.get("/api/fixtures?filter=all");
    expect(res.ok()).toBeTruthy();
    const fixtures = (await res.json()) as Array<{
      id: number;
      window: { canBet: boolean; reason: string };
      status: string;
    }>;
    const byId = (id: number) => fixtures.find((f) => f.id === id)!;

    expect(byId(OPEN_FIXTURE).window.canBet).toBe(true);
    expect(byId(OPEN_FIXTURE).window.reason).toBe("OPEN");

    expect(byId(CLOSED_FIXTURE).window.canBet).toBe(false);
    expect(byId(CLOSED_FIXTURE).window.reason).toBe("CLOSED");

    expect(byId(NOT_OPEN_FIXTURE).window.canBet).toBe(false);
    expect(byId(NOT_OPEN_FIXTURE).window.reason).toBe("NOT_OPEN_YET");

    expect(byId(LIVE_FIXTURE).window.canBet).toBe(false);
    expect(byId(LIVE_FIXTURE).status).toBe("LIVE");
  });

  test("place a bet on an OPEN fixture (1004) via UI; it persists across reload", async ({
    page,
  }) => {
    await login(page, freshUserEmail());
    await page.goto("/games"); // default upcoming includes OPEN fixtures

    // The fixture card for 1004: find the bet-form within the card that contains
    // the outcome buttons. There are multiple cards, so scope by the card article.
    const card = page
      .locator("article", { has: page.getByTestId("bet-form") })
      .filter({ hasText: "Brazil" })
      .filter({ hasText: "Argentina" })
      .first();
    await expect(card).toBeVisible();

    await card.getByTestId("outcome-home").click();
    // set score 2-1 via steppers
    await card.getByTestId("pred-home-inc").click();
    await card.getByTestId("pred-home-inc").click(); // 0 -> 2
    await card.getByTestId("pred-away-inc").click(); // 0 -> 1
    await expect(card.getByTestId("pred-home")).toHaveText("2");
    await expect(card.getByTestId("pred-away")).toHaveText("1");

    await card.getByTestId("save-bet").click();
    await expect(page.getByTestId("toast")).toContainText(/saved/i);

    // Verify via API the bet persisted as outcome HOME 2-1.
    const me = await page.request.get("/api/bets/me");
    expect(me.ok()).toBeTruthy();
    const bets = (await me.json()) as Array<{
      fixtureId: number;
      outcome: string;
      predHome: number;
      predAway: number;
    }>;
    const bet = bets.find((b) => b.fixtureId === OPEN_FIXTURE);
    expect(bet).toBeTruthy();
    expect(bet!.outcome).toBe("HOME");
    expect(bet!.predHome).toBe(2);
    expect(bet!.predAway).toBe(1);

    // Reload: the saved bet should be reflected as an "Update bet" form (existing bet).
    await page.reload();
    const cardReloaded = page
      .locator("article", { has: page.getByTestId("bet-form") })
      .filter({ hasText: "Brazil" })
      .filter({ hasText: "Argentina" })
      .first();
    await expect(cardReloaded.getByTestId("pred-home")).toHaveText("2");
    await expect(cardReloaded.getByTestId("pred-away")).toHaveText("1");
    await expect(cardReloaded.getByTestId("save-bet")).toHaveText(/update/i);
  });

  test("updating a bet does NOT create a duplicate (one bet per fixture)", async ({ page }) => {
    const email = freshUserEmail();
    await login(page, email);

    // First bet via API.
    await page.request.post("/api/bets", {
      data: { fixtureId: OPEN_FIXTURE, outcome: "HOME", predHome: 1, predAway: 0 },
    });
    // Second (update).
    const r2 = await page.request.post("/api/bets", {
      data: { fixtureId: OPEN_FIXTURE, outcome: "AWAY", predHome: 0, predAway: 3 },
    });
    expect(r2.ok()).toBeTruthy();

    const me = await page.request.get("/api/bets/me");
    const bets = (await me.json()) as Array<{ fixtureId: number; outcome: string }>;
    const matching = bets.filter((b) => b.fixtureId === OPEN_FIXTURE);
    expect(matching).toHaveLength(1);
    expect(matching[0].outcome).toBe("AWAY");
  });

  test("CLOSED fixture (1003) shows locked state; save control disabled", async ({ page }) => {
    await login(page, freshUserEmail());
    await gotoGamesAll(page);
    const card = page
      .locator("article", { has: page.getByTestId("bet-form") })
      .filter({ hasText: "Portugal" })
      .filter({ hasText: "Netherlands" })
      .first();
    await expect(card).toBeVisible();
    await expect(card.getByTestId("bet-locked")).toBeVisible();
    await expect(card.getByTestId("save-bet")).toBeDisabled();
  });

  test("NOT_OPEN_YET fixture (1007) shows locked state; save control disabled", async ({
    page,
  }) => {
    await login(page, freshUserEmail());
    await gotoGamesAll(page);
    const card = page
      .locator("article", { has: page.getByTestId("bet-form") })
      .filter({ hasText: "Germany" })
      .filter({ hasText: "Netherlands" })
      .first();
    await expect(card).toBeVisible();
    await expect(card.getByTestId("bet-locked")).toBeVisible();
    await expect(card.getByTestId("save-bet")).toBeDisabled();
  });

  test("POST /api/bets on a LIVE fixture (1002) returns 403 BET_WINDOW_CLOSED", async ({
    page,
  }) => {
    await login(page, freshUserEmail());
    const res = await page.request.post("/api/bets", {
      data: { fixtureId: LIVE_FIXTURE, outcome: "HOME", predHome: 1, predAway: 0 },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("BET_WINDOW_CLOSED");
  });

  test("POST /api/bets on a CLOSED fixture (1003) returns 403 BET_WINDOW_CLOSED", async ({
    page,
  }) => {
    await login(page, freshUserEmail());
    const res = await page.request.post("/api/bets", {
      data: { fixtureId: CLOSED_FIXTURE, outcome: "HOME", predHome: 1, predAway: 0 },
    });
    expect(res.status()).toBe(403);
    expect((await res.json()).error.code).toBe("BET_WINDOW_CLOSED");
  });
});
