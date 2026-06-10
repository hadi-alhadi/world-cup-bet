// Tier-2 gamification: badge catalog + idempotent award logic. Badges are awarded inside
// the scoring transaction (no drift, no separate jobs — handoff §15). The UserBadge unique
// constraint makes re-scoring a no-op via upsert-with-empty-update.
// Server-only badge logic (imports Prisma). The pure catalog (BADGES/BADGE_BY_KEY) lives
// in lib/badge-catalog.ts so client components can import it without dragging in Prisma.
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Outcome } from "@/lib/types";
import { BADGES, type BadgeWallEntry } from "@/lib/badge-catalog";

export type { BadgeWallEntry } from "@/lib/badge-catalog";

const HOUR_MS = 60 * 60 * 1000;
const HOT_STREAK_LEN = 5;
const LONGSHOT_THRESHOLD = 0.2;

function actualOutcome(home: number, away: number): Outcome {
  return home > away ? "HOME" : home < away ? "AWAY" : "DRAW";
}

async function award(tx: Prisma.TransactionClient, userId: string, badgeKey: string) {
  // upsert with empty update => idempotent insert (SQLite has no createMany skipDuplicates).
  await tx.userBadge.upsert({
    where: { userId_badgeKey: { userId, badgeKey } },
    create: { userId, badgeKey },
    update: {},
  });
}

// Called inside scoreFixture's transaction after bets are scored. openBeforeHours is read
// before the tx and passed in (avoids a second connection reading Settings mid-transaction).
export async function awardMatchBadges(
  tx: Prisma.TransactionClient,
  fixtureId: number,
  openBeforeHours: number,
): Promise<void> {
  const fixture = await tx.fixture.findUnique({ where: { id: fixtureId } });
  if (!fixture || fixture.homeScore == null || fixture.awayScore == null) return;

  const act = actualOutcome(fixture.homeScore, fixture.awayScore);
  const opensAtMs = fixture.kickoffAt.getTime() - openBeforeHours * HOUR_MS;

  const bets = await tx.bet.findMany({ where: { fixtureId } });
  const total = bets.length;
  const counts: Record<string, number> = { HOME: 0, DRAW: 0, AWAY: 0 };
  for (const b of bets) counts[b.outcome] = (counts[b.outcome] ?? 0) + 1;

  const userIds = new Set<string>();
  for (const b of bets) {
    userIds.add(b.userId);
    const exact = b.predHome === fixture.homeScore && b.predAway === fixture.awayScore;
    const correct = b.outcome === act;
    if (exact) await award(tx, b.userId, "sniper");
    if (correct && total > 0 && counts[b.outcome] / total < LONGSHOT_THRESHOLD) {
      await award(tx, b.userId, "against_the_odds");
    }
    if (b.createdAt.getTime() <= opensAtMs + HOUR_MS) await award(tx, b.userId, "early_bird");
  }

  // Hot Streak: longest run of consecutive correct (points >= 1) across the user's scored
  // bets ordered by kickoff. Achievement is sticky (kept even if the streak later breaks).
  for (const userId of userIds) {
    const scored = await tx.bet.findMany({
      where: { userId, points: { not: null } },
      include: { fixture: { select: { kickoffAt: true } } },
    });
    scored.sort((a, b) => a.fixture.kickoffAt.getTime() - b.fixture.kickoffAt.getTime());
    let run = 0;
    let max = 0;
    for (const s of scored) {
      if ((s.points ?? 0) >= 1) {
        run += 1;
        if (run > max) max = run;
      } else {
        run = 0;
      }
    }
    if (max >= HOT_STREAK_LEN) await award(tx, userId, "hot_streak");
  }
}

// Called inside scoreWinnerPicks' transaction: award Prophet to correct champion pickers.
export async function awardProphet(tx: Prisma.TransactionClient, teamId: number): Promise<void> {
  const picks = await tx.winnerPick.findMany({ where: { teamId } });
  for (const p of picks) await award(tx, p.userId, "prophet");
}

// Badge wall data for a user: every badge with earned/locked status.
export async function getBadgeWall(userId: string): Promise<BadgeWallEntry[]> {
  const earned = await prisma.userBadge.findMany({ where: { userId } });
  const map = new Map(earned.map((e) => [e.badgeKey, e.awardedAt]));
  return BADGES.map((b) => ({
    ...b,
    earned: map.has(b.key),
    awardedAt: map.get(b.key)?.toISOString() ?? null,
  }));
}

// Badge keys per user, for decorating the leaderboard. Returns Map<userId, badgeKey[]>.
export async function badgesByUser(userIds: string[]): Promise<Map<string, string[]>> {
  const rows = await prisma.userBadge.findMany({ where: { userId: { in: userIds } } });
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const list = map.get(r.userId) ?? [];
    list.push(r.badgeKey);
    map.set(r.userId, list);
  }
  return map;
}
