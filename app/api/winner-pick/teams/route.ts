// GET /api/winner-pick/teams — teams available for the champion pick (handoff R2).
import { NextResponse } from "next/server";
import { handle, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import type { TeamDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    await requireUser();
    const teams = await prisma.team.findMany({ orderBy: { name: "asc" } });
    const dto: TeamDTO[] = teams.map((t) => ({ id: t.id, name: t.name, logoUrl: t.logoUrl }));
    return NextResponse.json(dto);
  });
}
