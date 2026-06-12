// "Dice" — an admin-triggered bot player that places random predictions on the currently
// open games and locks a random champion. It's just a normal User row, so it shows up on
// the leaderboard and gets scored automatically by scoreFixture(). Reuses canBet() so it
// can only bet on genuinely open fixtures (server-authoritative).
import { prisma } from "@/lib/prisma";
import { canBet, getRoundOpens } from "@/lib/betting-window";
import { getWindowSettings, getWinnerPickDeadline } from "@/lib/settings";
import type { Outcome } from "@/lib/types";

export const DICE_EMAIL = "dice@privilee.ae";
const DICE_NAME = "Dice";

// Self-contained avatar (a 5-pip die) as an SVG data URI — no external asset; the
// leaderboard renders user.image via <img>.
const DICE_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
  `<rect width="100" height="100" rx="22" fill="#0f172a"/>` +
  `<g fill="#ffffff"><circle cx="30" cy="30" r="9"/><circle cx="70" cy="30" r="9"/>` +
  `<circle cx="50" cy="50" r="9"/><circle cx="30" cy="70" r="9"/><circle cx="70" cy="70" r="9"/></g></svg>`;
export const DICE_AVATAR = `data:image/svg+xml,${encodeURIComponent(DICE_SVG)}`;

// Random scoreline weighted toward realistic low scores (so exact-score hits are
// plausible but it's still clearly a coin-toss bot).
function rollGoals(): number {
  const r = Math.random();
  if (r < 0.3) return 0;
  if (r < 0.62) return 1;
  if (r < 0.85) return 2;
  if (r < 0.96) return 3;
  return 4;
}

function outcomeFromScore(home: number, away: number): Outcome {
  return home > away ? "HOME" : home < away ? "AWAY" : "DRAW";
}

async function ensureDiceUser() {
  return prisma.user.upsert({
    where: { email: DICE_EMAIL },
    update: { name: DICE_NAME, image: DICE_AVATAR },
    create: { email: DICE_EMAIL, name: DICE_NAME, image: DICE_AVATAR, role: "USER" },
  });
}

export interface DiceResult {
  betsPlaced: number;
  championPicked: string | null;
  alreadyBet: number;
}

// Place random bets on every open fixture Dice hasn't bet on yet, and (once) a random
// champion. Never overwrites an existing Dice bet, so re-running is safe — it just picks
// up newly-opened games.
export async function runDice(): Promise<DiceResult> {
  const user = await ensureDiceUser();
  const [settings, deadline] = await Promise.all([getWindowSettings(), getWinnerPickDeadline()]);
  const now = new Date();

  const [fixtures, existingBets, existingPick] = await Promise.all([
    prisma.fixture.findMany(),
    prisma.bet.findMany({ where: { userId: user.id }, select: { fixtureId: true } }),
    prisma.winnerPick.findUnique({ where: { userId: user.id } }),
  ]);
  const alreadyBet = new Set(existingBets.map((b) => b.fixtureId));
  const roundOpens = await getRoundOpens(settings.roundOpenBeforeHours);

  let betsPlaced = 0;
  for (const fx of fixtures) {
    if (alreadyBet.has(fx.id)) continue;
    if (!canBet(now, fx, settings, fx.roundKey ? roundOpens.get(fx.roundKey) : null)) continue;
    const predHome = rollGoals();
    const predAway = rollGoals();
    await prisma.bet.upsert({
      where: { userId_fixtureId: { userId: user.id, fixtureId: fx.id } },
      update: {}, // guard double-clicks: never clobber an existing Dice bet
      create: {
        userId: user.id,
        fixtureId: fx.id,
        outcome: outcomeFromScore(predHome, predAway),
        predHome,
        predAway,
      },
    });
    betsPlaced += 1;
  }

  // Champion: pick once, only while the window is still open.
  let championPicked: string | null = null;
  const deadlinePassed = deadline != null && deadline.getTime() <= now.getTime();
  if (!existingPick && !deadlinePassed) {
    const teams = await prisma.team.findMany({ select: { id: true, name: true } });
    if (teams.length > 0) {
      const team = teams[Math.floor(Math.random() * teams.length)];
      await prisma.winnerPick.create({ data: { userId: user.id, teamId: team.id } });
      championPicked = team.name;
    }
  }

  return { betsPlaced, championPicked, alreadyBet: alreadyBet.size };
}
