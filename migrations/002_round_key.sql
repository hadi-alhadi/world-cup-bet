-- Round-based betting windows: add Fixture.roundKey (the FIFA round bucket, e.g.
-- "Group Stage · Round 1", "Round of 16"). Apply to Turso BEFORE deploying the
-- round-window code, then run a sync to populate it from the feed's stage/matchday.
-- Run once (SQLite ALTER ADD COLUMN is not idempotent).
ALTER TABLE "Fixture" ADD COLUMN "roundKey" TEXT;
