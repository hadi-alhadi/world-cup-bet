// POST /api/admin/tournament-winner — admin finalizes the champion (handoff §8, R2).
// Persists the winning team then scores all winner picks (6 to correct, 0 otherwise).
import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, requireAdmin } from "@/lib/api";
import { setSetting, SETTING_KEYS } from "@/lib/settings";
import { scoreWinnerPicks } from "@/lib/scoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({ teamId: z.number().int() });

export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const { teamId } = Body.parse(await req.json());
    // Persist first so the source of truth is set before (re)scoring is derived from it.
    await setSetting(SETTING_KEYS.tournamentWinnerTeamId, String(teamId));
    const result = await scoreWinnerPicks(teamId);
    return NextResponse.json(result);
  });
}
