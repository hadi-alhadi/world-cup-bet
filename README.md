# Privilee Bet

A football prediction game for Privilee. Sign in with your Google `@privilee.ae` account, pick the tournament champion once, predict match outcomes (1/X/2) and exact scores, and climb the leaderboard. Admins enter official results, which triggers server-side scoring.

Scoring: correct outcome = **1 pt**, exact score = **+2 pts** (so a perfect score = 3), correct champion pick = **6 pts**.

## Stack

- **Next.js 14** (App Router) — single full-stack codebase
- **Prisma + libSQL** — Turso in production, local SQLite file (`prisma/dev.db`) in dev, via the Prisma driver adapter
- **NextAuth v5** — Google OAuth (with a dev mock-login mode for local/QA)
- **Tailwind CSS** + **Zod** (all API inputs validated)
- **Playwright** for E2E
- Deployed on **Vercel** (cron-driven fixture sync)

## Quickstart

```bash
cp .env.example .env     # local defaults: SQLite, dev login, seed fixtures
npm install
npm run db:push          # create the DB + tables
npm run db:seed          # settings defaults + seeded data + admin user
npm run dev              # http://localhost:3000
```

**Dev login:** with `AUTH_DEV_MODE=true` (the default) you can sign in as any `@privilee.ae` email — no Google setup needed. `ha@privilee.ae` is an **admin** (configured via `ADMIN_EMAILS`).

## Configuration

All env vars are documented in [`.env.example`](./.env.example) — copy it to `.env` and fill in values. Key groups: database (`DATABASE_URL` local / `TURSO_*` prod), auth (`NEXTAUTH_*`, `AUTH_DEV_MODE`, `GOOGLE_*`, `ADMIN_EMAILS`), fixtures provider (`FIXTURES_PROVIDER`, `THESPORTSDB_*`), and `CRON_SECRET`.

## Tests

```bash
npm run test:e2e         # headless Chromium E2E (auto-starts dev server)
npm run test:e2e:ui      # interactive Playwright UI
```

## Deployment

See **[`DEPLOY_RUNBOOK.md`](./DEPLOY_RUNBOOK.md)** for the full Vercel + Turso deploy guide (DB provisioning, schema push, OAuth, env vars, cron, smoke checklist, rollback).

## Docs

- **[`DEVELOPER_HANDOFF.md`](./DEVELOPER_HANDOFF.md)** — requirements (R1–R12), data model, API surface, scoring, product decisions.
- **[`DEPLOY_RUNBOOK.md`](./DEPLOY_RUNBOOK.md)** — deployment runbook.
