// GET /api/leaderboard — ranked totals + gamification (handoff R10, §14.5). The
// current user's row is flagged isMe so the UI can highlight it.
import { NextResponse } from "next/server";
import { handle, requireUser } from "@/lib/api";
import { getLeaderboard } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const rows = await getLeaderboard(user.id);
    return NextResponse.json(rows);
  });
}
