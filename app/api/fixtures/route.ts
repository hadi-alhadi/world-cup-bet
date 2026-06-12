// GET /api/fixtures?filter=upcoming|finished|all — fixtures with teams, window state,
// and the current user's bet. Window/scores recomputed server-side (never trusted from
// the client). Per-user data => force-dynamic.
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { handle, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getWindowSettings } from "@/lib/settings";
import { windowState, getRoundOpens } from "@/lib/betting-window";
import { DICE_EMAIL } from "@/lib/dice-bot";
import type { CommunityPicks, DicePick, FixtureDTO, FixtureStatus, Outcome } from "@/lib/types";

export const dynamic = "force-dynamic";

const filterSchema = z.enum(["upcoming", "finished", "all"]).default("all");

export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const filter = filterSchema.parse(req.nextUrl.searchParams.get("filter") ?? "all");

    // upcoming = SCHEDULED|LIVE ; finished = FINISHED ; all = everything.
    const where =
      filter === "upcoming"
        ? { status: { in: ["SCHEDULED", "LIVE"] } }
        : filter === "finished"
          ? { status: "FINISHED" }
          : {};

    const [fixtures, settings] = await Promise.all([
      prisma.fixture.findMany({
        where,
        orderBy: { kickoffAt: "asc" },
        include: {
          homeTeam: true,
          awayTeam: true,
          bets: { where: { userId: user.id } }, // 0 or 1 row (unique userId+fixtureId)
        },
      }),
      getWindowSettings(),
    ]);

    const now = new Date();

    // Dice bot's prediction per fixture (for the card-flip "peek"). One lookup of the
    // bot user + its bets, indexed by fixtureId.
    const diceUser = await prisma.user.findUnique({
      where: { email: DICE_EMAIL },
      select: { id: true },
    });
    const diceByFixture = new Map<number, DicePick>();
    if (diceUser) {
      const diceBets = await prisma.bet.findMany({
        where: { userId: diceUser.id, fixtureId: { in: fixtures.map((f) => f.id) } },
        select: { fixtureId: true, outcome: true, predHome: true, predAway: true },
      });
      for (const b of diceBets) {
        diceByFixture.set(b.fixtureId, {
          outcome: b.outcome as Outcome,
          predHome: b.predHome,
          predAway: b.predAway,
        });
      }
    }

    // Community picks reveal: only once the window is no longer OPEN and not still
    // waiting to open — i.e. CLOSED, LIVE, or FINISHED. Keeping it hidden while OPEN
    // (or NOT_OPEN_YET) means the distribution can't influence live bets.
    const roundOpens = await getRoundOpens(settings.roundOpenBeforeHours);
    const windows = new Map(
      fixtures.map((f) => [
        f.id,
        windowState(now, f, settings, f.roundKey ? roundOpens.get(f.roundKey) : null),
      ]),
    );
    const revealedIds = fixtures
      .filter((f) => {
        const r = windows.get(f.id)!.reason;
        return r !== "OPEN" && r !== "NOT_OPEN_YET";
      })
      .map((f) => f.id);

    // One groupBy for all revealed fixtures' outcome counts, then index by fixtureId.
    const picksByFixture = new Map<number, CommunityPicks>();
    if (revealedIds.length > 0) {
      const grouped = await prisma.bet.groupBy({
        by: ["fixtureId", "outcome"],
        where: { fixtureId: { in: revealedIds } },
        _count: { _all: true },
      });
      for (const id of revealedIds) {
        picksByFixture.set(id, { home: 0, draw: 0, away: 0, total: 0 });
      }
      for (const g of grouped) {
        const cp = picksByFixture.get(g.fixtureId)!;
        const n = g._count._all;
        if (g.outcome === "HOME") cp.home += n;
        else if (g.outcome === "DRAW") cp.draw += n;
        else if (g.outcome === "AWAY") cp.away += n;
        cp.total += n;
      }
    }

    const dto: FixtureDTO[] = fixtures.map((f) => {
      const bet = f.bets[0];
      return {
        id: f.id,
        homeTeam: { id: f.homeTeam.id, name: f.homeTeam.name, logoUrl: f.homeTeam.logoUrl },
        awayTeam: { id: f.awayTeam.id, name: f.awayTeam.name, logoUrl: f.awayTeam.logoUrl },
        kickoffAt: f.kickoffAt.toISOString(),
        round: f.round,
        roundKey: f.roundKey,
        status: f.status as FixtureStatus,
        homeScore: f.homeScore,
        awayScore: f.awayScore,
        needsManualResult: f.needsManualResult,
        resultDuration: f.resultDuration,
        window: windows.get(f.id)!,
        communityPicks: picksByFixture.get(f.id) ?? null,
        dicePick: diceByFixture.get(f.id) ?? null,
        myBet: bet
          ? {
              outcome: bet.outcome as Outcome,
              predHome: bet.predHome,
              predAway: bet.predAway,
              points: bet.points,
              updatedAt: bet.updatedAt.toISOString(),
            }
          : null,
      };
    });

    return NextResponse.json(dto);
  });
}
