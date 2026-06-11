-- Gamification Tier-2: UserBadge table (apply to Turso before deploying the badges code).
-- Idempotent (IF NOT EXISTS), safe to re-run.
CREATE TABLE IF NOT EXISTS "UserBadge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "badgeKey" TEXT NOT NULL,
    "awardedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "UserBadge_userId_idx" ON "UserBadge"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "UserBadge_userId_badgeKey_key" ON "UserBadge"("userId", "badgeKey");
