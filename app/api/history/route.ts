// GET /api/history — every fixture with every user's bet and its audit timestamps.
// Each fixture carries its lock time (kickoff − betCloseBeforeHours, default 2h); each
// bet is flagged when it was created at/after that lock — those are the records the
// history page highlights.
import { NextResponse } from "next/server";
import { handle, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getWindowSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const HOUR_MS = 60 * 60 * 1000;

export async function GET() {
  return handle(async () => {
    await requireUser();

    const [settings, fixtures] = await Promise.all([
      getWindowSettings(),
      prisma.fixture.findMany({
        // History = games that have started; upcoming fixtures stay hidden.
        where: { kickoffAt: { lte: new Date() } },
        orderBy: { kickoffAt: "asc" },
        include: {
          homeTeam: true,
          awayTeam: true,
          bets: {
            orderBy: { createdAt: "asc" },
            include: { user: true },
          },
        },
      }),
    ]);

    return NextResponse.json(
      fixtures.map((fx) => {
        // Same close rule as canBet(): betting is allowed only while now < closesAt,
        // so a record stamped at or after the lock is late.
        const lockAt = new Date(fx.kickoffAt.getTime() - settings.closeBeforeHours * HOUR_MS);
        return {
          id: fx.id,
          kickoffAt: fx.kickoffAt.toISOString(),
          lockAt: lockAt.toISOString(),
          round: fx.round,
          status: fx.status,
          homeScore: fx.homeScore,
          awayScore: fx.awayScore,
          homeTeam: { id: fx.homeTeam.id, name: fx.homeTeam.name, logoUrl: fx.homeTeam.logoUrl },
          awayTeam: { id: fx.awayTeam.id, name: fx.awayTeam.name, logoUrl: fx.awayTeam.logoUrl },
          bets: fx.bets.map((b) => ({
            id: b.id,
            outcome: b.outcome,
            predHome: b.predHome,
            predAway: b.predAway,
            points: b.points,
            createdAt: b.createdAt.toISOString(),
            updatedAt: b.updatedAt.toISOString(),
            createdAfterLock: b.createdAt.getTime() >= lockAt.getTime(),
            user: {
              id: b.user.id,
              name: b.user.name,
              email: b.user.email,
              image: b.user.image,
            },
          })),
        };
      }),
    );
  });
}
