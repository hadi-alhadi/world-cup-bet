// POST /api/admin/dice — admin-only: run the Dice bot (random bets + champion pick).
import { NextResponse } from "next/server";
import { handle, requireAdmin } from "@/lib/api";
import { runDice } from "@/lib/dice-bot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  return handle(async () => {
    await requireAdmin();
    const result = await runDice();
    return NextResponse.json(result);
  });
}
