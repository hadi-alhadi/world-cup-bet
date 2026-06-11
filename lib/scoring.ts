// Scoring (handoff §8). Idempotent: always recompute from scratch so admin
// corrections / re-saves never double-award.
import type { Bet, Fixture } from "@prisma/client";
import type { Outcome } from "@/lib/types";
import { prisma } from "@/lib/prisma";
import { awardMatchBadges, awardProphet } from "@/lib/badges";
import { getWindowSettings } from "@/lib/settings";

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

// Confirm a result and (re)score every bet on the fixture. Idempotent; clears
// needsManualResult (entering a 90' score resolves any ET/penalty flag).
//
// Turso note: do NOT update bets one-by-one inside an interactive transaction — on a
// remote DB each write is a network round-trip, and a per-bet loop blows past Prisma's
// 5s interactive-transaction timeout (the cause of the prod sync 500). Instead we group
// bets by points value into a handful of updateMany calls and run them with the fixture
// update as a single batched array transaction. Badges are awarded afterwards, outside
// the transaction (their writes are idempotent via the UserBadge unique constraint).
export async function scoreFixture(
  fixtureId: number,
  homeScore: number,
  awayScore: number,
): Promise<{ fixtureId: number; scoredBets: number }> {
  const { openBeforeHours } = await getWindowSettings();
  const bets = await prisma.bet.findMany({ where: { fixtureId } });

  const idsByPoints = new Map<number, string[]>();
  for (const bet of bets) {
    const points = scoreBet(bet, { homeScore, awayScore });
    const ids = idsByPoints.get(points);
    if (ids) ids.push(bet.id);
    else idsByPoints.set(points, [bet.id]);
  }

  await prisma.$transaction([
    prisma.fixture.update({
      where: { id: fixtureId },
      data: {
        homeScore,
        awayScore,
        status: "FINISHED",
        resultSetAt: new Date(),
        needsManualResult: false,
      },
    }),
    ...[...idsByPoints].map(([points, ids]) =>
      prisma.bet.updateMany({ where: { id: { in: ids } }, data: { points } }),
    ),
  ]);

  await awardMatchBadges(prisma, fixtureId, openBeforeHours);
  return { fixtureId, scoredBets: bets.length };
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
// Batched (see scoreFixture) to avoid per-row writes inside a timed transaction on Turso.
export async function scoreWinnerPicks(teamId: number): Promise<{ scored: number }> {
  const picks = await prisma.winnerPick.findMany({ select: { id: true, teamId: true } });
  const winnerIds = picks.filter((p) => p.teamId === teamId).map((p) => p.id);
  const otherIds = picks.filter((p) => p.teamId !== teamId).map((p) => p.id);

  await prisma.$transaction([
    ...(winnerIds.length
      ? [prisma.winnerPick.updateMany({ where: { id: { in: winnerIds } }, data: { points: POINTS_CHAMPION } })]
      : []),
    ...(otherIds.length
      ? [prisma.winnerPick.updateMany({ where: { id: { in: otherIds } }, data: { points: 0 } })]
      : []),
  ]);

  await awardProphet(prisma, teamId);
  return { scored: picks.length };
}
