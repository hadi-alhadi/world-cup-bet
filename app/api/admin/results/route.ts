// POST /api/admin/results — admin confirms a fixture's 90-minute score (handoff §8, §14.4).
// Sets FINISHED + (re)scores all bets in one transaction. Idempotent on re-save.
import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, requireAdmin } from "@/lib/api";
import { scoreFixture } from "@/lib/scoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  fixtureId: z.number().int(),
  homeScore: z.number().int().min(0),
  awayScore: z.number().int().min(0),
});

export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const { fixtureId, homeScore, awayScore } = Body.parse(await req.json());
    const result = await scoreFixture(fixtureId, homeScore, awayScore);
    return NextResponse.json(result);
  });
}
