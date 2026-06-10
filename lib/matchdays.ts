// Weekly matchday winners (Tier 3): per-round mini-leaderboards. Fixtures are grouped by
// `round`; each round's standings sum scored Bet.points per user across that round's
// fixtures. Tournament-scale data, so JS aggregation is fine.
import { prisma } from "@/lib/prisma";
import type { Matchday, MatchdayStanding } from "@/lib/types";

export async function getMatchdays(meId?: string): Promise<Matchday[]> {
  // Pull fixtures with their scored bets + the betting user's name/image. Null rounds are
  // skipped (a fixture must belong to a named round to count toward a matchday).
  const fixtures = await prisma.fixture.findMany({
    where: { round: { not: null } },
    select: {
      round: true,
      status: true,
      kickoffAt: true,
      bets: {
        where: { points: { not: null } }, // only scored bets contribute to standings
        select: {
          points: true,
          userId: true,
          user: { select: { name: true, image: true } },
        },
      },
    },
  });

  interface RoundAcc {
    round: string;
    earliestKickoff: number;
    allFinished: boolean;
    // per-user running total + identity
    byUser: Map<string, { name: string | null; image: string | null; points: number }>;
  }
  const rounds = new Map<string, RoundAcc>();

  for (const f of fixtures) {
    const round = f.round!; // not-null by query filter
    let acc = rounds.get(round);
    if (!acc) {
      acc = { round, earliestKickoff: Infinity, allFinished: true, byUser: new Map() };
      rounds.set(round, acc);
    }
    acc.earliestKickoff = Math.min(acc.earliestKickoff, f.kickoffAt.getTime());
    if (f.status !== "FINISHED") acc.allFinished = false;

    for (const b of f.bets) {
      const cur = acc.byUser.get(b.userId);
      if (cur) cur.points += b.points ?? 0;
      else
        acc.byUser.set(b.userId, {
          name: b.user.name,
          image: b.user.image,
          points: b.points ?? 0,
        });
    }
  }

  // Chronological by earliest kickoff in each round.
  const ordered = [...rounds.values()].sort((a, b) => a.earliestKickoff - b.earliestKickoff);

  return ordered.map((acc) => {
    // Rank: points DESC, then name ASC. Sequential ranks (no ties shared).
    const standings: MatchdayStanding[] = [...acc.byUser.entries()]
      .map(([userId, u]) => ({
        userId,
        name: u.name,
        image: u.image,
        points: u.points,
        rank: 0, // assigned below
        ...(meId ? { isMe: userId === meId } : {}),
      }))
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return (a.name ?? "").localeCompare(b.name ?? "");
      })
      .map((s, i) => ({ ...s, rank: i + 1 }));

    // Winner = rank-1 standing, but only once someone has actually scored points.
    const top = standings[0];
    const winner = top && top.points > 0 ? top : null;

    return {
      round: acc.round,
      finished: acc.allFinished,
      winner,
      standings,
    };
  });
}
