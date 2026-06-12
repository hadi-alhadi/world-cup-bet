// GET /api/rounds/next — the next round whose betting hasn't opened yet (soonest opensAt
// in the future, among rounds that still have SCHEDULED fixtures). Powers the games-page
// "next round opens in…" countdown. Returns { next: { roundKey, opensAt, firstKickoff } | null }.
import { NextResponse } from "next/server";
import { handle, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getWindowSettings } from "@/lib/settings";
import { getRoundOpens } from "@/lib/betting-window";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    await requireUser();
    const settings = await getWindowSettings();
    const roundOpens = await getRoundOpens(settings.roundOpenBeforeHours);
    const now = Date.now();

    // Only rounds with matches still to be played can "open".
    const rounds = await prisma.fixture.groupBy({
      by: ["roundKey"],
      where: { roundKey: { not: null }, status: "SCHEDULED" },
      _min: { kickoffAt: true },
    });

    let next: { roundKey: string; opensAt: string; firstKickoff: string } | null = null;
    for (const r of rounds) {
      if (!r.roundKey || !r._min.kickoffAt) continue;
      const opensAt = roundOpens.get(r.roundKey);
      if (!opensAt || opensAt.getTime() <= now) continue; // already open (or past)
      if (!next || opensAt.getTime() < new Date(next.opensAt).getTime()) {
        next = {
          roundKey: r.roundKey,
          opensAt: opensAt.toISOString(),
          firstKickoff: r._min.kickoffAt.toISOString(),
        };
      }
    }

    return NextResponse.json({ next });
  });
}
