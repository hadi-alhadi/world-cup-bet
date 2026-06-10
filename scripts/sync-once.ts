// One-off: run a real fixtures sync against the configured provider and report.
// Usage: FIXTURES_PROVIDER=thesportsdb THESPORTSDB_LEAGUE_ID=4429 THESPORTSDB_SEASON=2026 \
//        npx tsx scripts/sync-once.ts
import { syncFixtures, getProvider } from "@/lib/fixtures-provider";
import { prisma } from "@/lib/prisma";

async function main() {
  console.log("Provider:", process.env.FIXTURES_PROVIDER || "seed");
  const counts = await syncFixtures(getProvider());
  console.log("Synced:", counts);

  const sample = await prisma.fixture.findMany({
    take: 5,
    orderBy: { kickoffAt: "asc" },
    include: { homeTeam: true, awayTeam: true },
  });
  for (const f of sample) {
    console.log(
      ` ${f.kickoffAt.toISOString()}  ${f.homeTeam.name} vs ${f.awayTeam.name}  [${f.status}]`,
    );
  }
  const total = await prisma.fixture.count();
  const teams = await prisma.team.count();
  console.log(`DB now: ${teams} teams, ${total} fixtures`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
