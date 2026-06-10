// /api/admin/sync — trigger fixtures sync (handoff §7, §8).
// Auth, any of: an admin session · header `x-cron-secret` · `Authorization: Bearer <CRON_SECRET>`
// (the last is how Vercel Cron authenticates — it sends GET and cannot set custom headers).
// NOTE: middleware lets this path bypass the session gate; the route self-guards below.
import { NextResponse } from "next/server";
import { handle, requireAdmin, HttpError } from "@/lib/api";
import { syncFixtures } from "@/lib/fixtures-provider";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function hasValidCronSecret(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (req.headers.get("x-cron-secret") === secret) return true;
  const bearer = req.headers.get("authorization");
  return bearer === `Bearer ${secret}`;
}

async function run(req: Request) {
  return handle(async () => {
    // Prefer admin session; fall back to the cron secret for headless/scheduled calls.
    try {
      await requireAdmin();
    } catch {
      if (!hasValidCronSecret(req)) {
        throw new HttpError("FORBIDDEN", "Admin or valid cron secret required", 403);
      }
    }
    const counts = await syncFixtures();
    return NextResponse.json(counts);
  });
}

export const POST = run; // admin panel button / x-cron-secret callers
export const GET = run; // Vercel Cron (Authorization: Bearer CRON_SECRET)
