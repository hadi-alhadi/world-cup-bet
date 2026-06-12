// GET/PUT /api/admin/settings — read/update betting window config (handoff §6, §8).
// Settings are read fresh on every use elsewhere, so persisting here takes effect
// without a restart (§13: changing close hours must apply live).
import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, requireAdmin } from "@/lib/api";
import { getSetting, setSetting, SETTING_KEYS } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Returns the four configurable settings as their raw stored/default values (or null).
async function currentSettings() {
  const [
    betCloseBeforeHours,
    roundOpenBeforeHours,
    winnerPickDeadline,
    tournamentWinnerTeamId,
  ] = await Promise.all([
    getSetting(SETTING_KEYS.betCloseBeforeHours),
    getSetting(SETTING_KEYS.roundOpenBeforeHours),
    getSetting(SETTING_KEYS.winnerPickDeadline),
    getSetting(SETTING_KEYS.tournamentWinnerTeamId),
  ]);
  return {
    round_open_before_hours: roundOpenBeforeHours,
    bet_close_before_hours: betCloseBeforeHours,
    winner_pick_deadline: winnerPickDeadline,
    tournament_winner_team_id: tournamentWinnerTeamId,
  };
}

export async function GET() {
  return handle(async () => {
    await requireAdmin();
    return NextResponse.json(await currentSettings());
  });
}

const PutBody = z.object({
  roundOpenBeforeHours: z.number().int().positive().optional(),
  betCloseBeforeHours: z.number().int().positive().optional(),
  // ISO datetime string; validate parseability so we never persist garbage.
  winnerPickDeadline: z.string().datetime().optional(),
});

export async function PUT(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const body = PutBody.parse(await req.json());

    // Persist only the keys the client actually provided.
    if (body.roundOpenBeforeHours !== undefined) {
      await setSetting(SETTING_KEYS.roundOpenBeforeHours, String(body.roundOpenBeforeHours));
    }
    if (body.betCloseBeforeHours !== undefined) {
      await setSetting(SETTING_KEYS.betCloseBeforeHours, String(body.betCloseBeforeHours));
    }
    if (body.winnerPickDeadline !== undefined) {
      await setSetting(SETTING_KEYS.winnerPickDeadline, body.winnerPickDeadline);
    }

    return NextResponse.json(await currentSettings());
  });
}
