// GET /api/winner-pick/me — the current user's champion pick (with team) or null.
import { NextResponse } from "next/server";
import { handle, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const pick = await prisma.winnerPick.findUnique({
      where: { userId: user.id },
      include: { team: true },
    });
    if (!pick) return NextResponse.json(null);

    return NextResponse.json({
      id: pick.id,
      points: pick.points,
      team: { id: pick.team.id, name: pick.team.name, logoUrl: pick.team.logoUrl },
    });
  });
}
