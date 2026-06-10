import { execSync } from "node:child_process";
import path from "node:path";

/**
 * Re-seed the dev SQLite DB before the suite so tests start from the deterministic
 * baseline described in DEVELOPER_HANDOFF.md (fixtures 1000-1009 in known states,
 * seeded users + bets). The seed is idempotent (upserts) and notably resets fixture
 * statuses/scores — important because admin-scoring tests mutate fixture 1006 to
 * FINISHED, and without a re-seed it would no longer be bettable on a second run.
 *
 * The dev server (reuseExistingServer) reads the same file, and routes are
 * force-dynamic with no caching, so it picks up the reseeded rows immediately.
 */
export default function globalSetup(): void {
  const root = path.resolve(__dirname, "..");
  execSync("npm run db:seed", { cwd: root, stdio: "inherit" });
}
