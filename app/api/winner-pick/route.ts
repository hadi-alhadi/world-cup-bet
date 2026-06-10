// POST /api/winner-pick — one-time champion pick (handoff R2, §14.3 locked at first
// save). Rejects a second pick (409) and picks after the global deadline (403).
import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, requireUser, HttpError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getWinnerPickDeadline } from "@/lib/settings";

export const dynamic = "force-dynamic";

const pickSchema = z.object({ teamId: z.number().int() });

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = pickSchema.parse(await req.json());

    // Locked at first save (§14.3): if one already exists, never overwrite it.
    const existing = await prisma.winnerPick.findUnique({ where: { userId: user.id } });
    if (existing) {
      throw new HttpError("ALREADY_PICKED", "You have already picked a champion", 409);
    }

    // Deadline is server-authoritative.
    const deadline = await getWinnerPickDeadline();
    if (deadline && new Date() >= deadline) {
      throw new HttpError("DEADLINE_PASSED", "The champion pick deadline has passed", 403);
    }

    // Validate the team exists to avoid a dangling FK / confusing 500.
    const team = await prisma.team.findUnique({ where: { id: body.teamId } });
    if (!team) throw new HttpError("NOT_FOUND", "Team not found", 404);

    const pick = await prisma.winnerPick.create({
      data: { userId: user.id, teamId: body.teamId },
    });

    return NextResponse.json(
      { id: pick.id, teamId: pick.teamId, points: pick.points },
      { status: 201 },
    );
  });
}
