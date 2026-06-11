// GET /api/winner-pick/status — lightweight banner feed: has the user picked a champion,
// and when does the pick window close. (Separate from /me so its shape stays stable.)
import { NextResponse } from "next/server";
import { handle, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getWinnerPickDeadline } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const [pick, deadline] = await Promise.all([
      prisma.winnerPick.findUnique({ where: { userId: user.id }, select: { id: true } }),
      getWinnerPickDeadline(),
    ]);
    return NextResponse.json({
      hasPicked: !!pick,
      deadline: deadline ? deadline.toISOString() : null,
    });
  });
}
