// Daily Slack reminder: for every match in the next 24h that's still open for betting,
// list the members who haven't bet yet (names only; the Dice bot is excluded). Posts a
// structured message to SLACK_WEBHOOK_URL. Called by an external cron (Bearer-secret).
import { prisma } from "@/lib/prisma";
import { canBet } from "@/lib/betting-window";
import { getWindowSettings } from "@/lib/settings";
import { DICE_EMAIL } from "@/lib/dice-bot";

const HORIZON_MS = 24 * 60 * 60 * 1000;

type SlackBlock = Record<string, unknown>;

export interface ReminderResult {
  matches: number;
  posted: boolean;
  skipped?: boolean;
}

export async function runBetReminders(): Promise<ReminderResult> {
  const webhook = process.env.SLACK_WEBHOOK_URL;
  const appUrl = process.env.NEXTAUTH_URL ?? "https://privilee-bet.vercel.app";

  const settings = await getWindowSettings();
  const now = new Date();
  const horizon = new Date(now.getTime() + HORIZON_MS);

  // Matches kicking off within the next 24h that are still SCHEDULED and bettable
  // (window open) — no point reminding about games you can no longer bet on.
  const fixtures = await prisma.fixture.findMany({
    where: { status: "SCHEDULED", kickoffAt: { gt: now, lte: horizon } },
    orderBy: { kickoffAt: "asc" },
    include: { homeTeam: true, awayTeam: true, bets: { select: { userId: true } } },
  });
  const upcoming = fixtures.filter((f) => canBet(now, f, settings));

  if (upcoming.length === 0) {
    return { matches: 0, posted: false, skipped: true };
  }

  // All human members (exclude the Dice bot).
  const members = await prisma.user.findMany({
    where: { email: { not: DICE_EMAIL } },
    select: { id: true, name: true },
  });

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: { type: "plain_text", text: "⚽ World Cup Bet — Daily Bet Reminder", emoji: true },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*${upcoming.length} match${upcoming.length === 1 ? "" : "es"}* coming up in the next 24 hours. ` +
          `Lock in your prediction before kickoff! 🏆\n🔗 <${appUrl}|Place your bets>`,
      },
    },
    { type: "divider" },
  ];

  for (const f of upcoming) {
    const bettorIds = new Set(f.bets.map((b) => b.userId));
    const missing = members.filter((m) => !bettorIds.has(m.id));
    const unix = Math.floor(f.kickoffAt.getTime() / 1000);
    const fallback = `${f.kickoffAt.toISOString().slice(0, 16).replace("T", " ")} UTC`;

    const lines = [
      `*${f.homeTeam.name} vs ${f.awayTeam.name}*`,
      `🕘 Kicks off <!date^${unix}^{date_short_pretty} {time}|${fallback}> · betting closes 2h before`,
    ];
    if (missing.length === 0) {
      lines.push("✅ *Everyone's in!*");
    } else {
      lines.push(`❗ *Still missing a bet (${missing.length}):*`);
      lines.push(missing.map((m) => m.name ?? "Unknown").join(", "));
    }

    blocks.push({ type: "section", text: { type: "mrkdwn", text: lines.join("\n") } });
    blocks.push({ type: "divider" });
  }

  // No webhook configured (e.g. local dev): compute but don't post.
  if (!webhook) return { matches: upcoming.length, posted: false };

  const res = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `World Cup Bet reminder — ${upcoming.length} match(es) in the next 24h`,
      blocks,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Slack webhook failed: ${res.status} ${body}`);
  }

  return { matches: upcoming.length, posted: true };
}
