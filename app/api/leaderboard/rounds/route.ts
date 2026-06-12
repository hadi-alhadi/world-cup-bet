// GET /api/leaderboard/rounds — per-round mini-leaderboards for the Leaderboard round
// tabs (top 2 / bottom 2 / Dice, only for rounds that have started). Marks the current
// user (isMe) => force-dynamic.
import { NextResponse } from "next/server";
import { handle, requireUser } from "@/lib/api";
import { getRoundStandings } from "@/lib/round-standings";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    return NextResponse.json(await getRoundStandings(user.id));
  });
}
