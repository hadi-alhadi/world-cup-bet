// Leaderboard (handoff §10) + Gamification Tier 1 (build-design): streaks & pundit
// titles. Ranking is computed in JS (not SQL) because the §14.5 tiebreaker needs the
// average Bet.updatedAt per user, which is awkward to express portably across libSQL.
import { prisma } from "@/lib/prisma";
import type { LeaderboardRow } from "@/lib/types";

interface UserAgg {
  userId: string;
  name: string | null;
  image: string | null;
  matchPoints: number;
  winnerPoints: number;
  total: number;
  avgUpdatedAt: number; // ms epoch; Infinity when the user has no bets
  streak: number;
}

export async function getLeaderboard(meId?: string): Promise<LeaderboardRow[]> {
  // Pull every user with their bets (incl. fixture kickoff for streak ordering) and
  // their winner pick. Volumes are tiny (single tournament) so this is cheap.
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      image: true,
      winnerPick: { select: { points: true } },
      bets: {
        select: {
          points: true,
          updatedAt: true,
          fixture: { select: { kickoffAt: true } },
        },
      },
    },
  });

  const aggs: UserAgg[] = users.map((u) => {
    const matchPoints = u.bets.reduce((sum, b) => sum + (b.points ?? 0), 0);
    const winnerPoints = u.winnerPick?.points ?? 0;

    // §14.5 tiebreaker: earlier average submission time wins. No bets => Infinity so
    // such users sort last among equal totals (then fall back to name).
    const avgUpdatedAt =
      u.bets.length === 0
        ? Infinity
        : u.bets.reduce((s, b) => s + b.updatedAt.getTime(), 0) / u.bets.length;

    // Streak: current run of consecutive correct bets (points >= 1) walking from the
    // most recent SCORED bet backwards by kickoff. Only scored bets (points != null)
    // count; an unscored future bet doesn't break a streak.
    const scored = u.bets
      .filter((b) => b.points != null)
      .sort((a, b) => b.fixture.kickoffAt.getTime() - a.fixture.kickoffAt.getTime());
    let streak = 0;
    for (const b of scored) {
      if ((b.points ?? 0) >= 1) streak++;
      else break;
    }

    return {
      userId: u.id,
      name: u.name,
      image: u.image,
      matchPoints,
      winnerPoints,
      total: matchPoints + winnerPoints,
      avgUpdatedAt,
      streak,
    };
  });

  // Rank: total DESC, then earlier avg Bet.updatedAt ASC (§14.5), then name ASC.
  aggs.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (a.avgUpdatedAt !== b.avgUpdatedAt) return a.avgUpdatedAt - b.avgUpdatedAt;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });

  const totalUsers = aggs.length;
  return aggs.map((a, i) => {
    const rank = i + 1; // sequential — no shared ranks (§10, tiebreaker is near-unique)
    return {
      userId: a.userId,
      name: a.name,
      image: a.image,
      matchPoints: a.matchPoints,
      winnerPoints: a.winnerPoints,
      total: a.total,
      rank,
      streak: a.streak,
      title: punditTitle(rank, totalUsers),
      ...(meId ? { isMe: a.userId === meId } : {}),
    };
  });
}

// Pundit title by rank percentile (Gamification Tier 1):
//   rank 1            => "Oracle"
//   top 25%           => "Tactician"
//   bottom 3 (and >1) => "Benchwarmer"
//   otherwise         => "Pundit"
function punditTitle(rank: number, total: number): string {
  if (total === 0) return "Pundit";
  if (rank === 1) return "Oracle";
  if (rank <= Math.ceil(total * 0.25)) return "Tactician";
  if (total > 1 && rank > total - 3) return "Benchwarmer";
  return "Pundit";
}
