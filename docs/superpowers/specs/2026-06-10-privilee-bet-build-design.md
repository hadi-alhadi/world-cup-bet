# Privilee Bet — Build Design & Decisions

**Date:** 2026-06-10 · **Owner:** Hadi (ha@privilee.ae)
**Source spec:** `DEVELOPER_HANDOFF.md` (authoritative for requirements R1–R12, schema, API, UX).

This document records the build-time decisions that the handoff left open, and the team plan.

## Decisions (resolved this session)

| Topic | Decision | Rationale |
|---|---|---|
| Database | **Turso (libSQL)** via Prisma driver adapter | SQLite-compatible (handoff schema unchanged), works on Vercel serverless, free tier. Same adapter runs locally against `file:` and in prod against `libsql://`. |
| Scope | **Core v1 (R1–R12) + Gamification Tier 1** | Streaks, exact-score confetti, rank-movement arrows, pundit titles, deadline FOMO. |
| Fixture data | **Provider adapter**: `SeedProvider` (default, offline) + `TheSportsDbProvider` (free, no key) | Replaces paid API-Football. QA runs with zero external deps. API-Football can be added later as a third adapter. |
| Auth | **Mock dev login** (`AUTH_DEV_MODE=true`) + real Google provider wired (key added later) | Lets Playwright/QA exercise role-gated flows now; `@privilee.ae` domain check + `hd` param stay wired. |
| Deployment | **Prepare + runbook** (no live deploy yet) | DevOps produces `vercel.json`, env templates, Turso migration steps, cron config, runbook. Live deploy is a follow-up needing a Vercel token. |

## Architecture (per handoff §3, adapted)

- Next.js 14 App Router, single full-stack codebase.
- `lib/` modules are the shared contracts (see below). All bet/window/scoring validation is server-side; UI disabling is cosmetic.
- Times stored UTC; rendered in local tz (default `Asia/Dubai`).

### lib contracts (interfaces the team builds against)

- `lib/prisma.ts` — `prisma` PrismaClient (libSQL adapter).
- `lib/settings.ts` — `getSettingNumber(key, fallback)`, `getSetting(key)`, `setSetting(key,value)`, `SETTING_DEFAULTS`.
- `lib/betting-window.ts` — `getWindow(fixture, settings)`, `canBet(now, fixture, settings)`.
- `lib/scoring.ts` — `scoreBet(bet, fixture): number`, `scoreFixture(fixtureId)` (idempotent, transactional), `scoreWinnerPicks(teamId)`.
- `lib/fixtures-provider.ts` — `FixturesProvider` interface, `getProvider()`, `SeedProvider`, `TheSportsDbProvider`, `syncFixtures()`.
- `lib/leaderboard.ts` — `getLeaderboard()` (totals, tiebreaker §14.5, streaks, rank, pundit title).
- `lib/auth.ts` — NextAuth v5 config (Google + dev credentials), role + domain checks.
- `lib/types.ts` — shared TS types (DTOs for API responses).

## Team plan (multi-agent)

- **Staff Engineer (orchestrator):** establishes foundation/contracts, sequences agents, reviews handoffs, integrates, runs Playwright verification.
- **Senior DevOps:** project scaffold config, Prisma+Turso wiring, Vercel prep + runbook, cron.
- **Senior Fullstack #1 (backend/data):** schema finalize, `lib` core (settings, window, scoring, provider, seed), all `/api/*` routes, Zod validation.
- **Senior Fullstack #2 (auth/features):** auth (mock+Google), middleware, leaderboard + gamification logic, admin endpoints wiring.
- **Senior UI/UX:** Tailwind design system + all pages (games, my-bets, pick-winner, leaderboard, admin, login).
- **QA:** Playwright E2E against handoff §13 checklist + gamification; defects reported back.

## Verification

Playwright drives a real browser: dev-login → games/betting → winner pick → leaderboard → admin scoring → leaderboard reflects points. Plus the §13 boundary/security checks at the API level.
