// GET /api/badges/me — the current user's badge wall (every badge, earned/locked).
// Per-user => force-dynamic.
import { NextResponse } from "next/server";
import { handle, requireUser } from "@/lib/api";
import { getBadgeWall } from "@/lib/badges";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    return NextResponse.json(await getBadgeWall(user.id));
  });
}
