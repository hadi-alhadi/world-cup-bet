// Per-minute fixtures sync + result auto-import. Run locally:
//   npx tsx --env-file=.env scripts/sync-loop.ts
// Does a full sync (teams + fixtures) on start, then a fixtures-only sync every minute
// (teams are static during a tournament), with a full refresh hourly. force:true bypasses
// the SYNC_MIN_INTERVAL guard. Each cycle is a fresh provider instance (no stale cache).
import { syncFixtures, getProvider } from "@/lib/fixtures-provider";

const INTERVAL_MS = 60_000;

async function cycle(skipTeams: boolean) {
  const ts = new Date().toISOString();
  try {
    const r = await syncFixtures(getProvider(), { force: true, skipTeams });
    console.log(
      `${ts}  sync ok  teams=${r.teams} fixtures=${r.fixtures} scored=${r.scored ?? 0} manual=${r.manual ?? 0}${skipTeams ? " (fixtures-only)" : ""}`,
    );
  } catch (e) {
    console.error(`${ts}  sync ERROR  ${String(e)}`);
  }
}

async function main() {
  console.log(`sync-loop start — provider=${process.env.FIXTURES_PROVIDER}, every ${INTERVAL_MS / 1000}s`);
  await cycle(false); // initial full sync (teams + fixtures)
  let n = 0;
  setInterval(() => {
    n += 1;
    void cycle(n % 60 !== 0); // fixtures-only each minute; full refresh every 60th
  }, INTERVAL_MS);
}

void main();
