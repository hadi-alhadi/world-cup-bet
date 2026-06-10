// GET /api/bets/me — the current user's bets with their fixture + points (handoff R9).
import { NextResponse } from "next/server";
import { handle, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const user = await requireUser();

    const bets = await prisma.bet.findMany({
      where: { userId: user.id },
      orderBy: { fixture: { kickoffAt: "asc" } },
      include: { fixture: { include: { homeTeam: true, awayTeam: true } } },
    });

    return NextResponse.json(
      bets.map((b) => ({
        id: b.id,
        fixtureId: b.fixtureId,
        outcome: b.outcome,
        predHome: b.predHome,
        predAway: b.predAway,
        points: b.points,
        updatedAt: b.updatedAt.toISOString(),
        fixture: {
          id: b.fixture.id,
          kickoffAt: b.fixture.kickoffAt.toISOString(),
          round: b.fixture.round,
          status: b.fixture.status,
          homeScore: b.fixture.homeScore,
          awayScore: b.fixture.awayScore,
          homeTeam: {
            id: b.fixture.homeTeam.id,
            name: b.fixture.homeTeam.name,
            logoUrl: b.fixture.homeTeam.logoUrl,
          },
          awayTeam: {
            id: b.fixture.awayTeam.id,
            name: b.fixture.awayTeam.name,
            logoUrl: b.fixture.awayTeam.logoUrl,
          },
        },
      })),
    );
  });
}
