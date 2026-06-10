// Scoring (handoff §8). Idempotent: always recompute from scratch so admin
// corrections / re-saves never double-award.
import type { Bet, Fixture } from "@prisma/client";
import type { Outcome } from "@/lib/types";
import { prisma } from "@/lib/prisma";

export const POINTS_OUTCOME = 1;
export const POINTS_EXACT_BONUS = 2; // exact score => 3 total
export const POINTS_CHAMPION = 6;

export function actualOutcome(homeScore: number, awayScore: number): Outcome {
  if (homeScore > awayScore) return "HOME";
  if (homeScore < awayScore) return "AWAY";
  return "DRAW";
}

export function scoreBet(
  bet: Pick<Bet, "outcome" | "predHome" | "predAway">,
  fx: Pick<Fixture, "homeScore" | "awayScore">,
): number {
  if (fx.homeScore == null || fx.awayScore == null) return 0;
  let pts = 0;
  if (bet.outcome === actualOutcome(fx.homeScore, fx.awayScore)) pts += POINTS_OUTCOME;
  if (bet.predHome === fx.homeScore && bet.predAway === fx.awayScore) pts += POINTS_EXACT_BONUS;
  return pts;
}

// Confirm a result and (re)score every bet on the fixture in one transaction.
// Clears needsManualResult — entering a 90' score resolves any ET/penalty flag.
export async function scoreFixture(
  fixtureId: number,
  homeScore: number,
  awayScore: number,
): Promise<{ fixtureId: number; scoredBets: number }> {
  return prisma.$transaction(async (tx) => {
    const fixture = await tx.fixture.update({
      where: { id: fixtureId },
      data: {
        homeScore,
        awayScore,
        status: "FINISHED",
        resultSetAt: new Date(),
        needsManualResult: false,
      },
    });
    const bets = await tx.bet.findMany({ where: { fixtureId } });
    for (const bet of bets) {
      const points = scoreBet(bet, fixture);
      await tx.bet.update({ where: { id: bet.id }, data: { points } });
    }
    return { fixtureId, scoredBets: bets.length };
  });
}

export type FeedDuration = "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT";

// Apply a result that arrived from the sync feed, honoring §14.4 (bets score on the
// 90-minute result, excluding ET/penalties):
//  - REGULAR: fullTime IS the 90' result -> auto-score normally.
//  - EXTRA_TIME / PENALTY_SHOOTOUT: the match was level at 90' (a DRAW), but the feed
//    folds ET goals into fullTime so the exact 90' score is unknown. Mark the fixture
//    FINISHED + needsManualResult so the admin enters the 90' score; do NOT score bets.
export async function applyFeedResult(
  fixtureId: number,
  homeScore: number,
  awayScore: number,
  duration: FeedDuration,
): Promise<"scored" | "manual"> {
  if (duration === "REGULAR") {
    await scoreFixture(fixtureId, homeScore, awayScore);
    await prisma.fixture.update({ where: { id: fixtureId }, data: { resultDuration: duration } });
    return "scored";
  }
  await prisma.fixture.update({
    where: { id: fixtureId },
    data: { status: "FINISHED", needsManualResult: true, resultDuration: duration },
  });
  return "manual";
}

// Award champion points: 6 to picks matching teamId, 0 to the rest. Idempotent.
export async function scoreWinnerPicks(teamId: number): Promise<{ scored: number }> {
  return prisma.$transaction(async (tx) => {
    const picks = await tx.winnerPick.findMany();
    for (const pick of picks) {
      const points = pick.teamId === teamId ? POINTS_CHAMPION : 0;
      await tx.winnerPick.update({ where: { id: pick.id }, data: { points } });
    }
    return { scored: picks.length };
  });
}
