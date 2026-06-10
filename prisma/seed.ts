// Database seed (tsx-runnable: `tsx prisma/seed.ts`). Idempotent — uses upserts so
// re-seeding is safe. Produces a realistic, deterministic dataset:
//   - settings defaults (window hours + winner-pick deadline)
//   - 8 teams + ~10 fixtures (every betting-window state, two FINISHED with scores)
//   - 1 admin + 2 sample users with bets on the FINISHED fixtures (varied points so
//     the leaderboard is non-empty) and one winner pick each
//   - finished fixtures are scored; winner picks are NOT (tournament not finalized)
import { prisma } from "@/lib/prisma";
import { SETTING_KEYS } from "@/lib/settings";
import { scoreBet } from "@/lib/scoring";
import { TEAMS, FIXTURES, type SeedFixture } from "@/prisma/seed-data";
import type { Outcome } from "@/lib/types";

async function upsertSetting(key: string, value: string) {
  await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

async function upsertUser(email: string, name: string, role: "USER" | "ADMIN") {
  return prisma.user.upsert({
    where: { email },
    update: { name, role },
    create: { email, name, role },
  });
}

// Upsert a bet by the unique (userId, fixtureId) and score it against the fixture
// if that fixture is FINISHED (so leaderboard totals are populated immediately).
async function upsertScoredBet(
  userId: string,
  fx: SeedFixture,
  outcome: Outcome,
  predHome: number,
  predAway: number,
) {
  const points =
    fx.status === "FINISHED" && fx.homeScore != null && fx.awayScore != null
      ? scoreBet({ outcome, predHome, predAway }, { homeScore: fx.homeScore, awayScore: fx.awayScore })
      : null;

  await prisma.bet.upsert({
    where: { userId_fixtureId: { userId, fixtureId: fx.id } },
    update: { outcome, predHome, predAway, points },
    create: { userId, fixtureId: fx.id, outcome, predHome, predAway, points },
  });
  return points;
}

async function upsertWinnerPick(userId: string, teamId: number) {
  // WinnerPick.userId is unique; tournament not finalized so points stays null.
  await prisma.winnerPick.upsert({
    where: { userId },
    update: { teamId, points: null },
    create: { userId, teamId, points: null },
  });
}

async function main() {
  // --- Settings -----------------------------------------------------------------
  await upsertSetting(SETTING_KEYS.betOpenBeforeHours, "168"); // 7 days
  await upsertSetting(SETTING_KEYS.betCloseBeforeHours, "2");
  await upsertSetting(SETTING_KEYS.winnerPickDeadline, "2026-06-25T00:00:00.000Z");
  // tournament_winner_team_id intentionally unset (tournament not finalized).

  // --- Teams --------------------------------------------------------------------
  for (const t of TEAMS) {
    await prisma.team.upsert({
      where: { id: t.id },
      update: { name: t.name, logoUrl: t.logoUrl },
      create: { id: t.id, name: t.name, logoUrl: t.logoUrl },
    });
  }

  // --- Fixtures (seed scores/status straight from seed-data) --------------------
  for (const f of FIXTURES) {
    const data = {
      homeTeamId: f.homeTeamId,
      awayTeamId: f.awayTeamId,
      kickoffAt: f.kickoffAt,
      round: f.round,
      status: f.status,
      homeScore: f.homeScore ?? null,
      awayScore: f.awayScore ?? null,
      resultSetAt: f.status === "FINISHED" ? new Date() : null,
    };
    await prisma.fixture.upsert({
      where: { id: f.id },
      update: data,
      create: { id: f.id, ...data },
    });
  }

  // --- Users --------------------------------------------------------------------
  const admin = await upsertUser("ha@privilee.ae", "Hadi", "ADMIN");
  const alex = await upsertUser("alex@privilee.ae", "Alex", "USER");
  const sam = await upsertUser("sam@privilee.ae", "Sam", "USER");

  // Finished fixtures: 1000 = Brazil 2-1 France (HOME), 1001 = Argentina 0-0 Germany (DRAW).
  const fx1000 = FIXTURES.find((f) => f.id === 1000)!;
  const fx1001 = FIXTURES.find((f) => f.id === 1001)!;

  // Alex: one EXACT (3pts) + one outcome-only (1pt) => 4 match points.
  await upsertScoredBet(alex.id, fx1000, "HOME", 2, 1); // exact => 3
  await upsertScoredBet(alex.id, fx1001, "DRAW", 1, 1); // outcome only => 1

  // Sam: one wrong (0pt) + one outcome-only (1pt) => 1 match point.
  await upsertScoredBet(sam.id, fx1000, "AWAY", 0, 2); // wrong => 0
  await upsertScoredBet(sam.id, fx1001, "DRAW", 0, 0); // exact draw => 3

  // Admin also places a couple of bets so they appear on the leaderboard.
  await upsertScoredBet(admin.id, fx1000, "HOME", 1, 0); // outcome only => 1
  await upsertScoredBet(admin.id, fx1001, "HOME", 2, 0); // wrong => 0

  // --- Winner picks (not scored: tournament not finalized) ----------------------
  await upsertWinnerPick(alex.id, 100); // Brazil
  await upsertWinnerPick(sam.id, 102); // Argentina
  await upsertWinnerPick(admin.id, 101); // France

  // --- Summary ------------------------------------------------------------------
  const [teamCount, fixtureCount, userCount, betCount, pickCount] = await Promise.all([
    prisma.team.count(),
    prisma.fixture.count(),
    prisma.user.count(),
    prisma.bet.count(),
    prisma.winnerPick.count(),
  ]);
  console.log("Seed complete:");
  console.log(`  settings:    4 (window hours + winner-pick deadline)`);
  console.log(`  teams:       ${teamCount}`);
  console.log(`  fixtures:    ${fixtureCount}`);
  console.log(`  users:       ${userCount} (1 admin, 2 users)`);
  console.log(`  bets:        ${betCount} (scored on finished fixtures)`);
  console.log(`  winnerPicks: ${pickCount} (unscored — tournament not finalized)`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
