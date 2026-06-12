// POST/GET /api/cron/bet-reminders — posts the daily "who hasn't bet" Slack reminder.
// Auth: admin session OR the cron secret (x-cron-secret header or Authorization: Bearer).
// Middleware lets this path bypass the session gate; the route self-guards below.
import { NextResponse } from "next/server";
import { handle, requireAdmin, HttpError } from "@/lib/api";
import { runBetReminders } from "@/lib/bet-reminders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function hasValidCronSecret(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (req.headers.get("x-cron-secret") === secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function run(req: Request) {
  return handle(async () => {
    try {
      await requireAdmin();
    } catch {
      if (!hasValidCronSecret(req)) {
        throw new HttpError("FORBIDDEN", "Admin or valid cron secret required", 403);
      }
    }
    const result = await runBetReminders();
    return NextResponse.json(result);
  });
}

export const POST = run;
export const GET = run;
