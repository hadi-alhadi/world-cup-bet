// GET /api/matchdays — per-round mini-leaderboards with weekly winners (Tier 3).
// Marks the current user (isMe) => force-dynamic.
import { NextResponse } from "next/server";
import { handle, requireUser } from "@/lib/api";
import { getMatchdays } from "@/lib/matchdays";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    return NextResponse.json(await getMatchdays(user.id));
  });
}
