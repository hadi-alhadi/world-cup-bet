// Verifies the §14.4 auto-import logic end-to-end against the real DB.
import { prisma } from "@/lib/prisma";
import { applyFeedResult, scoreFixture } from "@/lib/scoring";

const T1 = 99001, T2 = 99002; // teams
const FX_REG = 990001, FX_ET = 990002; // fixtures
const UA = "verify-a@privilee.ae", UB = "verify-b@privilee.ae";

function assert(cond: boolean, msg: string) {
  console.log(`${cond ? "PASS" : "FAIL"} — ${msg}`);
  if (!cond) process.exitCode = 1;
}

async function main() {
  // clean slate for our test ids
  await prisma.bet.deleteMany({ where: { fixtureId: { in: [FX_REG, FX_ET] } } });
  await prisma.fixture.deleteMany({ where: { id: { in: [FX_REG, FX_ET] } } });
  await prisma.team.deleteMany({ where: { id: { in: [T1, T2] } } });
  await prisma.user.deleteMany({ where: { email: { in: [UA, UB] } } });

  await prisma.team.createMany({ data: [{ id: T1, name: "Alpha" }, { id: T2, name: "Beta" }] });
  const a = await prisma.user.create({ data: { email: UA, name: "A" } });
  const b = await prisma.user.create({ data: { email: UB, name: "B" } });
  for (const id of [FX_REG, FX_ET]) {
    await prisma.fixture.create({
      data: { id, homeTeamId: T1, awayTeamId: T2, kickoffAt: new Date("2026-07-01T18:00:00Z"), round: "Test", status: "LIVE" },
    });
  }

  // --- REGULAR: Alpha beats Beta 2-1. A bets HOME 2-1 (exact); B bets DRAW 0-0 (wrong). ---
  await prisma.bet.create({ data: { userId: a.id, fixtureId: FX_REG, outcome: "HOME", predHome: 2, predAway: 1 } });
  await prisma.bet.create({ data: { userId: b.id, fixtureId: FX_REG, outcome: "DRAW", predHome: 0, predAway: 0 } });
  const r1 = await applyFeedResult(FX_REG, 2, 1, "REGULAR");
  assert(r1 === "scored", "REGULAR result auto-scores");
  const fxReg = await prisma.fixture.findUnique({ where: { id: FX_REG } });
  assert(fxReg?.status === "FINISHED" && fxReg.homeScore === 2 && fxReg.awayScore === 1, "REGULAR fixture stored 2-1 FINISHED");
  const aReg = await prisma.bet.findUnique({ where: { userId_fixtureId: { userId: a.id, fixtureId: FX_REG } } });
  const bReg = await prisma.bet.findUnique({ where: { userId_fixtureId: { userId: b.id, fixtureId: FX_REG } } });
  assert(aReg?.points === 3, `exact-score bet = 3 (got ${aReg?.points})`);
  assert(bReg?.points === 0, `wrong bet = 0 (got ${bReg?.points})`);

  // --- EXTRA TIME: feed fullTime 2-1 but duration EXTRA_TIME (so 90' was a DRAW). ---
  // A bets DRAW 1-1; B bets HOME 2-1. Auto-import must NOT score; must flag for admin.
  await prisma.bet.create({ data: { userId: a.id, fixtureId: FX_ET, outcome: "DRAW", predHome: 1, predAway: 1 } });
  await prisma.bet.create({ data: { userId: b.id, fixtureId: FX_ET, outcome: "HOME", predHome: 2, predAway: 1 } });
  const r2 = await applyFeedResult(FX_ET, 2, 1, "EXTRA_TIME");
  assert(r2 === "manual", "EXTRA_TIME result is flagged for manual entry, not scored");
  const fxEt = await prisma.fixture.findUnique({ where: { id: FX_ET } });
  assert(fxEt?.status === "FINISHED" && fxEt.needsManualResult === true && fxEt.homeScore === null, "ET fixture FINISHED + needsManualResult + NO score");
  const aEt1 = await prisma.bet.findUnique({ where: { userId_fixtureId: { userId: a.id, fixtureId: FX_ET } } });
  assert(aEt1?.points == null, "ET bets remain unscored until admin enters 90' score");

  // --- Admin enters the 90' score: it was 1-1 (a draw). ---
  await scoreFixture(FX_ET, 1, 1);
  const fxEt2 = await prisma.fixture.findUnique({ where: { id: FX_ET } });
  assert(fxEt2?.needsManualResult === false && fxEt2.homeScore === 1, "admin 90' entry clears the manual flag");
  const aEt2 = await prisma.bet.findUnique({ where: { userId_fixtureId: { userId: a.id, fixtureId: FX_ET } } });
  const bEt2 = await prisma.bet.findUnique({ where: { userId_fixtureId: { userId: b.id, fixtureId: FX_ET } } });
  assert(aEt2?.points === 3, `DRAW 1-1 vs 90' 1-1 = 3 (got ${aEt2?.points})`);
  assert(bEt2?.points === 0, `HOME bet on a 90' draw = 0 (got ${bEt2?.points})`);

  // cleanup
  await prisma.bet.deleteMany({ where: { fixtureId: { in: [FX_REG, FX_ET] } } });
  await prisma.fixture.deleteMany({ where: { id: { in: [FX_REG, FX_ET] } } });
  await prisma.team.deleteMany({ where: { id: { in: [T1, T2] } } });
  await prisma.user.deleteMany({ where: { email: { in: [UA, UB] } } });
  await prisma.$disconnect();
}

main().catch((e) => { console.error(String(e)); process.exit(1); });
