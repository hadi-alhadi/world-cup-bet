// Per-round mini-leaderboards for the Leaderboard "round" tabs. Fixtures are grouped by
// `roundKey` (the FIFA round: "Group Stage · Round 1/2/3", "Round of 32", …). A round is
// only returned once it has STARTED (its earliest kickoff is in the past). For each
// started round we surface the top 2 and bottom 2 human scorers plus the Dice bot's
// standing. Tournament-scale data, so JS aggregation is fine.
import { prisma } from "@/lib/prisma";
import { DICE_EMAIL } from "@/lib/dice-bot";
import type { RoundStanding, RoundStandings } from "@/lib/types";

export async function getRoundStandings(meId?: string): Promise<RoundStandings[]> {
  // Pull fixtures with their scored bets + the betting user's identity. Null roundKeys are
  // skipped (a fixture must belong to a round to count toward a round tab).
  const fixtures = await prisma.fixture.findMany({
    where: { roundKey: { not: null } },
    select: {
      roundKey: true,
      status: true,
      kickoffAt: true,
      bets: {
        where: { points: { not: null } }, // only scored bets contribute to standings
        select: {
          points: true,
          userId: true,
          user: { select: { name: true, image: true, email: true } },
        },
      },
    },
  });

  interface RoundAcc {
    roundKey: string;
    earliestKickoff: number;
    allFinished: boolean;
    byUser: Map<
      string,
      { name: string | null; image: string | null; email: string | null; points: number }
    >;
  }
  const rounds = new Map<string, RoundAcc>();

  for (const f of fixtures) {
    const roundKey = f.roundKey!; // not-null by query filter
    let acc = rounds.get(roundKey);
    if (!acc) {
      acc = { roundKey, earliestKickoff: Infinity, allFinished: true, byUser: new Map() };
      rounds.set(roundKey, acc);
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
          email: b.user.email,
          points: b.points ?? 0,
        });
    }
  }

  const now = Date.now();
  // Only rounds that have started (first match kicked off), chronological by kickoff.
  const ordered = [...rounds.values()]
    .filter((acc) => acc.earliestKickoff <= now)
    .sort((a, b) => a.earliestKickoff - b.earliestKickoff);

  return ordered.map((acc) => {
    // Rank everyone in the round (incl. Dice): points DESC, then name ASC. This rank is
    // used for the Dice line ("Nth overall"); human rows are re-ranked among humans below.
    const all = [...acc.byUser.entries()]
      .map(([userId, u]) => ({
        userId,
        name: u.name,
        image: u.image,
        email: u.email,
        points: u.points,
        rank: 0,
        ...(meId ? { isMe: userId === meId } : {}),
      }))
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return (a.name ?? "").localeCompare(b.name ?? "");
      })
      .map((s, i) => ({ ...s, rank: i + 1 }));

    const strip = ({ userId, name, image, points, rank, isMe }: (typeof all)[number]): RoundStanding => ({
      userId,
      name,
      image,
      points,
      rank,
      ...(isMe !== undefined ? { isMe } : {}),
    });

    // Dice gets its own line, ranked among all participants.
    const dice = all.find((s) => s.email === DICE_EMAIL) ?? null;

    // Humans re-ranked among themselves (1..n) for the top/bottom slices.
    const humans = all
      .filter((s) => s.email !== DICE_EMAIL)
      .map((s, i) => ({ ...s, rank: i + 1 }));

    const top2 = humans.filter((s) => s.points > 0).slice(0, 2);
    const topIds = new Set(top2.map((s) => s.userId));
    // Bottom 2 = lowest scorers, never repeating someone already shown in the top.
    const bottom2 = humans.filter((s) => !topIds.has(s.userId)).slice(-2);

    return {
      roundKey: acc.roundKey,
      finished: acc.allFinished,
      top2: top2.map(strip),
      bottom2: bottom2.map(strip),
      dice: dice ? strip(dice) : null,
    };
  });
}
