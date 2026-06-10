// POST /api/bets — upsert a bet (handoff R6/R9). Server-authoritative window check:
// the fixture is loaded fresh and canBet() recomputed; the client cannot bypass it.
import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, requireUser, HttpError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getWindowSettings } from "@/lib/settings";
import { canBet } from "@/lib/betting-window";

export const dynamic = "force-dynamic";

const betSchema = z.object({
  fixtureId: z.number().int(),
  outcome: z.enum(["HOME", "DRAW", "AWAY"]),
  predHome: z.number().int().min(0),
  predAway: z.number().int().min(0),
});

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = betSchema.parse(await req.json());

    const [fixture, settings] = await Promise.all([
      prisma.fixture.findUnique({ where: { id: body.fixtureId } }),
      getWindowSettings(),
    ]);
    if (!fixture) throw new HttpError("NOT_FOUND", "Fixture not found", 404);

    // Window is server-authoritative; status (LIVE/FINISHED/etc.) is handled inside canBet.
    if (!canBet(new Date(), fixture, settings)) {
      throw new HttpError("BET_WINDOW_CLOSED", "Betting window is closed", 403);
    }

    // Upsert by the unique (userId, fixtureId). New bet stays unscored (points = null);
    // editing an existing bet must NOT carry forward a stale points value.
    const bet = await prisma.bet.upsert({
      where: { userId_fixtureId: { userId: user.id, fixtureId: body.fixtureId } },
      update: {
        outcome: body.outcome,
        predHome: body.predHome,
        predAway: body.predAway,
        points: null,
      },
      create: {
        userId: user.id,
        fixtureId: body.fixtureId,
        outcome: body.outcome,
        predHome: body.predHome,
        predAway: body.predAway,
      },
    });

    return NextResponse.json({
      id: bet.id,
      fixtureId: bet.fixtureId,
      outcome: bet.outcome,
      predHome: bet.predHome,
      predAway: bet.predAway,
      points: bet.points,
      updatedAt: bet.updatedAt.toISOString(),
    });
  });
}
