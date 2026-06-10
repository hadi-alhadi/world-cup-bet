// Verifies Tier-2 badge awarding through the real scoring path (scoreFixture/scoreWinnerPicks).
import { prisma } from "@/lib/prisma";
import { scoreFixture, scoreWinnerPicks } from "@/lib/scoring";

const TEAM_A = 98001, TEAM_B = 98002, TEAM_CHAMP = 98003;
const HOUR = 3600_000;

function ok(cond: boolean, msg: string) {
  console.log(`${cond ? "PASS" : "FAIL"} — ${msg}`);
  if (!cond) process.exitCode = 1;
}
async function has(userId: string, key: string) {
  return !!(await prisma.userBadge.findUnique({ where: { userId_badgeKey: { userId, badgeKey: key } } }));
}
let fxSeq = 980000;
async function mkFixture(kickoffMsFromNow: number) {
  const id = ++fxSeq;
  await prisma.fixture.create({
    data: { id, homeTeamId: TEAM_A, awayTeamId: TEAM_B, kickoffAt: new Date(Date.now() + kickoffMsFromNow), round: "VB", status: "SCHEDULED" },
  });
  return id;
}
async function mkUser(email: string) {
  return prisma.user.create({ data: { email, name: email.split("@")[0] } });
}

async function cleanup() {
  await prisma.bet.deleteMany({ where: { fixture: { round: "VB" } } });
  await prisma.winnerPick.deleteMany({ where: { teamId: TEAM_CHAMP } });
  await prisma.userBadge.deleteMany({ where: { user: { email: { contains: "+vb@privilee.ae" } } } });
  await prisma.fixture.deleteMany({ where: { round: "VB" } });
  await prisma.user.deleteMany({ where: { email: { contains: "+vb@privilee.ae" } } });
  await prisma.team.deleteMany({ where: { id: { in: [TEAM_A, TEAM_B, TEAM_CHAMP] } } });
}

async function main() {
  await cleanup();
  await prisma.team.createMany({ data: [
    { id: TEAM_A, name: "VB Alpha" }, { id: TEAM_B, name: "VB Beta" }, { id: TEAM_CHAMP, name: "VB Champ" },
  ]});

  // --- Sniper: exact score ---
  const sniper = await mkUser("sniper+vb@privilee.ae");
  const fxS = await mkFixture(48 * HOUR);
  await prisma.bet.create({ data: { userId: sniper.id, fixtureId: fxS, outcome: "HOME", predHome: 2, predAway: 1 } });
  await scoreFixture(fxS, 2, 1);
  ok(await has(sniper.id, "sniper"), "Sniper awarded for an exact score");

  // --- Early Bird: bet within 1h of window opening (opens 168h before kickoff) ---
  const early = await mkUser("early+vb@privilee.ae");
  const fxE = await mkFixture(168 * HOUR - 30 * 60_000); // opensAt ~ 30min ago
  await prisma.bet.create({ data: { userId: early.id, fixtureId: fxE, outcome: "HOME", predHome: 1, predAway: 0, createdAt: new Date() } });
  await scoreFixture(fxE, 1, 0);
  ok(await has(early.id, "early_bird"), "Early Bird awarded for betting within 1h of window open");

  // --- Against the Odds: correct on an outcome <20% of bettors picked ---
  const longshot = await mkUser("longshot+vb@privilee.ae");
  const fxO = await mkFixture(72 * HOUR);
  for (let i = 0; i < 5; i++) {
    const u = await mkUser(`crowd${i}+vb@privilee.ae`);
    await prisma.bet.create({ data: { userId: u.id, fixtureId: fxO, outcome: "HOME", predHome: 2, predAway: 0 } });
  }
  await prisma.bet.create({ data: { userId: longshot.id, fixtureId: fxO, outcome: "AWAY", predHome: 0, predAway: 1 } });
  await scoreFixture(fxO, 0, 1); // AWAY wins; only 1/6 (16.7%) picked AWAY
  ok(await has(longshot.id, "against_the_odds"), "Against the Odds awarded (1/6 picked the winner)");

  // --- Hot Streak: 5 correct in a row ---
  const streak = await mkUser("streak+vb@privilee.ae");
  for (let i = 0; i < 5; i++) {
    const fx = await mkFixture((100 + i) * HOUR);
    await prisma.bet.create({ data: { userId: streak.id, fixtureId: fx, outcome: "HOME", predHome: 1, predAway: 0 } });
    await scoreFixture(fx, 1, 0); // HOME wins -> correct each time
  }
  ok(await has(streak.id, "hot_streak"), "Hot Streak awarded after 5 consecutive correct");

  // --- Prophet: champion pick correct ---
  const prophet = await mkUser("prophet+vb@privilee.ae");
  await prisma.winnerPick.create({ data: { userId: prophet.id, teamId: TEAM_CHAMP } });
  await scoreWinnerPicks(TEAM_CHAMP);
  ok(await has(prophet.id, "prophet"), "Prophet awarded for a correct champion pick");

  // --- Idempotency: re-score does not error / duplicate ---
  await scoreFixture(fxS, 2, 1);
  const sniperCount = await prisma.userBadge.count({ where: { userId: sniper.id, badgeKey: "sniper" } });
  ok(sniperCount === 1, "Re-scoring does not duplicate a badge (idempotent)");

  await cleanup();
  await prisma.$disconnect();
}
main().catch((e) => { console.error(String(e)); process.exit(1); });
