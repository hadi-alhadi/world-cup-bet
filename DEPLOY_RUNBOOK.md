# Privilee Bet — Deploy Runbook

Copy-pasteable steps to take Privilee Bet from a fresh repo to a running Vercel deployment backed by Turso (libSQL).

> **Status:** This runbook prepares deployment. No live deploy has been performed. Live deploy is a follow-up that needs a Vercel account/token and the Turso + Google credentials below.

**Stack:** Next.js 14 (App Router) · Prisma + libSQL (Turso prod / local SQLite dev) · NextAuth v5 · Vercel.

---

## 0. Prerequisites

| Tool / account | Why | How |
|---|---|---|
| **Node 20+** | Build + Prisma CLI (Vercel uses Node 20 by default) | `node -v` ≥ 20 |
| **Turso account + CLI** | Production database (libSQL) | `brew install tursodatabase/tap/turso` then `turso auth login` |
| **Vercel account + CLI** (optional) | Hosting + cron | `npm i -g vercel` then `vercel login` |
| **Google Cloud project** | Google OAuth client for prod login | https://console.cloud.google.com → APIs & Services → Credentials |
| **OpenSSL** | Generate `NEXTAUTH_SECRET` | ships with macOS/Linux |

The repo's `.env.example` is the source of truth for env var names — keep this runbook aligned with it.

---

## 1. Provision the Turso database

```bash
# Create the database (pick a region close to your users, e.g. fra/ams for EU/ME).
turso db create privilee-bet --location fra

# Get the libsql:// connection URL — this is TURSO_DATABASE_URL.
turso db show privilee-bet --url
# -> libsql://privilee-bet-<org>.turso.io

# Mint an auth token — this is TURSO_AUTH_TOKEN. Treat it as a secret.
turso db tokens create privilee-bet
```

Record both values; you'll paste them into Vercel in Step 4.

---

## 2. Push the schema to Turso, then seed

The repo uses `provider = "sqlite"` in `prisma/schema.prisma` and reaches Turso at **runtime** via the `@prisma/adapter-libsql` driver adapter. The **Prisma CLI**, however, does **not** speak the driver adapter — `prisma db push` / `migrate` read `DATABASE_URL` directly and only understand a `file:` URL for a SQLite datasource. So we don't point the CLI at `libsql://`.

**Reliable path: build the schema in a local SQLite file, then import that file into Turso.** This is deterministic and avoids CLI/libSQL edge cases.

```bash
# 2a. Create a throwaway local SQLite file with the exact schema.
#     (db push reads DATABASE_URL from your env / .env — keep it as file:./dev.db)
DATABASE_URL="file:./prisma/deploy.db" npm run db:push

# 2b. Import the SQLite file straight into the Turso database.
#     This replaces the remote DB contents with the local file's schema (+ any data).
turso db shell privilee-bet < <(sqlite3 ./prisma/deploy.db .dump)
```

> If `turso db shell <db> < file` rejects the dump, use the explicit import flow instead:
> ```bash
> sqlite3 ./prisma/deploy.db .dump > schema.sql
> turso db shell privilee-bet < schema.sql
> ```

**Seed against Turso.** The seed script (`prisma/seed.ts`) runs through the app's Prisma client, which honors `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` when present:

```bash
TURSO_DATABASE_URL="libsql://privilee-bet-<org>.turso.io" \
TURSO_AUTH_TOKEN="<token>" \
npm run db:seed
```

This writes the `Setting` defaults (betting-window config) and any bootstrap data. Verify:

```bash
turso db shell privilee-bet "SELECT key, value FROM Setting;"
```

> **Migrations later:** since we keep `provider = "sqlite"`, future schema changes follow the same pattern — `db push` to a local file, diff/dump, import to Turso — or adopt Turso's own migration tooling. There is no Prisma Migrate history wired into prod by design (schema is small and stable).

Clean up the throwaway file when done: `rm -f ./prisma/deploy.db schema.sql`.

---

## 3. Google OAuth setup

Production login must be real Google (dev mock is disabled in prod — see `AUTH_DEV_MODE=false`).

1. Google Cloud Console → **APIs & Services → Credentials → Create Credentials → OAuth client ID → Web application**.
2. **Authorized redirect URIs** (NextAuth's Google callback path is `/api/auth/callback/google`):
   - `https://<your-prod-domain>/api/auth/callback/google` (e.g. `https://bet.privilee.ae/api/auth/callback/google`)
   - `http://localhost:3000/api/auth/callback/google` (for local testing of real OAuth)
   - Add the Vercel preview domain too if you log in on previews: `https://<project>-<hash>.vercel.app/api/auth/callback/google`
3. **Authorized JavaScript origins:** `https://<your-prod-domain>` and `http://localhost:3000`.
4. Copy the **Client ID** and **Client secret** → `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
5. **Domain restriction:** the app passes `hd=privilee.ae` to Google AND re-checks the email domain server-side in the NextAuth `signIn` callback (handoff §11/§14.2). The `hd` param alone is not security — the server-side check is the real gate. Nothing extra to configure here, but verify it during smoke test (Step 7).

---

## 4. Vercel project + environment variables

Import the repo in the Vercel dashboard (or `vercel link`). Then set the following Environment Variables (Project → Settings → Environment Variables). Set them for **Production** (and Preview if you want previews to work).

| Variable | Secret? | Value / notes |
|---|---|---|
| `TURSO_DATABASE_URL` | no | `libsql://privilee-bet-<org>.turso.io` (from Step 1). Runtime adapter prefers this over `DATABASE_URL`. |
| `TURSO_AUTH_TOKEN` | **YES** | Token from `turso db tokens create` (Step 1). |
| `NEXTAUTH_SECRET` | **YES** | `openssl rand -base64 32` — generate a fresh one for prod, do not reuse the dev value. |
| `NEXTAUTH_URL` | no | Your prod URL, e.g. `https://bet.privilee.ae`. Must match the OAuth redirect host. |
| `AUTH_DEV_MODE` | no | `false` — **critical.** Leaving this `true` in prod enables the mock "sign in as anyone" login. |
| `GOOGLE_CLIENT_ID` | no | From Step 3. |
| `GOOGLE_CLIENT_SECRET` | **YES** | From Step 3. |
| `ADMIN_EMAILS` | no | Comma-separated, e.g. `ha@privilee.ae`. These emails get `role = ADMIN` on sign-in. |
| `FIXTURES_PROVIDER` | no | `seed` (offline) or `thesportsdb` (free live data, no key needed). |
| `THESPORTSDB_KEY` | no | Public test key `3` is fine for the free tier. |
| `THESPORTSDB_LEAGUE_ID` | no | Competition id, e.g. `4429` (World Cup example). |
| `THESPORTSDB_SEASON` | no | e.g. `2026`. |
| `CRON_SECRET` | **YES** | Protects `/api/admin/sync`. Vercel **also** uses this to authenticate its own cron calls (see Step 6) — so this value is mandatory in prod. Generate with `openssl rand -hex 32`. |

> `DATABASE_URL` is **not** needed in Vercel runtime (the libSQL adapter uses the `TURSO_*` vars). It's only used by the Prisma CLI locally during Step 2.

---

## 5. Build settings

- **Framework preset:** Next.js (auto-detected; also pinned in `vercel.json`).
- **Build command:** `npm run build` → runs `prisma generate && next build`. Prisma Client must be generated at build time on Vercel (their dependency cache can skip postinstall), which this command handles.
- **Output:** default (`.next`). No override needed.
- **Node version:** 20.x (Project → Settings → Node.js Version).
- **Runtime:** auth/admin/api routes set `export const runtime = "nodejs"` (Prisma + libSQL cannot run on the Edge runtime). Already set by the app devs — do not switch these to edge.

---

## 6. Cron (fixture sync)

`vercel.json` registers a cron that hits the sync endpoint every 8 hours:

```json
"crons": [{ "path": "/api/admin/sync", "schedule": "0 */8 * * *" }]
```

This satisfies the "every 6–12h" sync requirement (handoff §7). Cron jobs run only on **Production** deployments.

### ⚠️ Required follow-up for the sync route owner

Vercel's cron invocation differs from how the route is currently written. **Two mismatches must be fixed in `app/api/admin/sync/route.ts` before cron will work:**

1. **HTTP method.** Vercel cron sends a **GET** request. The route currently only exports `POST`. → Add a `GET` handler (or have `GET` delegate to the same logic as `POST`).
2. **Auth header.** Vercel cron **cannot send custom headers** — it does not send `x-cron-secret`. Instead, when a `CRON_SECRET` env var is set, Vercel automatically attaches `Authorization: Bearer $CRON_SECRET` to the cron request. The route currently checks only `req.headers.get("x-cron-secret")`. → Also accept `Authorization: Bearer <CRON_SECRET>`.

Suggested fix for the route owner (illustrative — keeps existing admin-session + `x-cron-secret` paths, adds the Vercel path):

```ts
function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");           // Vercel cron
  const legacy = req.headers.get("x-cron-secret");          // manual / existing callers
  return auth === `Bearer ${secret}` || legacy === secret;
}

export async function GET(req: Request) { /* run sync if isAuthorizedCron(req) */ }
```

Until this is done, the scheduled cron will return 403 and fixtures won't auto-refresh. **Manual sync from the admin panel (admin session) and `POST` with `x-cron-secret` keep working regardless.**

Verify cron after deploy: Vercel dashboard → Project → **Crons** tab shows the schedule and last run; or trigger manually with the admin "Sync" button.

---

## 7. Post-deploy smoke checklist

Run against the production URL after the first deploy:

- [ ] **Login** — visit prod URL, sign in with a `@privilee.ae` Google account → lands authenticated. A non-privilee account is rejected with the friendly error (confirms server-side domain check, not just `hd`).
- [ ] **Dev mock is OFF** — there is no "sign in as anyone" option (confirms `AUTH_DEV_MODE=false`).
- [ ] **Fixtures load** — `/games` shows fixtures from the DB (seeded or synced). If using `thesportsdb`, run a sync first.
- [ ] **Place a bet** — pick 1/X/2 + score on an open fixture; reload → bet persists. Try a closed/finished fixture → blocked.
- [ ] **Admin scores** — as an `ADMIN_EMAILS` user, enter a result in `/admin`; bets get points (re-saving recomputes, no double award).
- [ ] **Leaderboard updates** — totals reflect the scored bets and champion bonus; tie ordering looks right.
- [ ] **Champion pick** — pick a team; second attempt is blocked (locked at first save).
- [ ] **API/secret not in client** — open DevTools → Network/Sources; confirm no `TURSO_AUTH_TOKEN`, `THESPORTSDB_KEY`, `GOOGLE_CLIENT_SECRET`, or `CRON_SECRET` appears in any client bundle or response.
- [ ] **Cron** — Vercel → Crons tab shows the job; after the route follow-up (Step 6), a manual cron trigger returns 200.

---

## 8. Rollback / DB backup

**Code rollback:** Vercel → Deployments → pick the previous good deployment → **Promote to Production** (instant, no rebuild).

**Database:**

- Turso keeps **point-in-time backups** automatically on paid plans; check `turso db show privilee-bet` for retention.
- **Manual logical backup any time:**
  ```bash
  turso db shell privilee-bet ".dump" > backup-$(date +%F).sql
  ```
- **Restore** into a fresh DB:
  ```bash
  turso db create privilee-bet-restore
  turso db shell privilee-bet-restore < backup-YYYY-MM-DD.sql
  ```
  Then swap `TURSO_DATABASE_URL` (and a fresh token) in Vercel and redeploy/promote.

> Because scoring is recomputed idempotently from results, a restore plus a re-sync recovers the live state without double-awarding points.

---

## 9. Local dev quickstart

Mirrors handoff §12 with this repo's actual scripts:

```bash
cp .env.example .env     # defaults: local SQLite, AUTH_DEV_MODE=true, seed provider
npm install
npm run db:push          # create prisma/dev.db + tables from schema (no migration files)
npm run db:seed          # settings defaults + seeded teams/fixtures + admin user
npm run dev              # http://localhost:3000
```

- **Dev login:** with `AUTH_DEV_MODE=true` you can sign in as any `@privilee.ae` email (no Google needed). `ha@privilee.ae` is an admin (via `ADMIN_EMAILS`).
- **Reset the DB:** `npm run db:reset` (drops `prisma/dev.db`, re-pushes, re-seeds).
- **E2E tests:** `npm run test:e2e` (headless Chromium; Playwright auto-starts the dev server) or `npm run test:e2e:ui`.
