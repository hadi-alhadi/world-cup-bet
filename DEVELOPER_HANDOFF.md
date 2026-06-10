# Privilee Bet — Developer Handoff Document

**Version:** 1.0 · **Date:** 2026-06-10 · **Owner:** Hadi (ha@privilee.ae)

A football prediction game where users sign in with Google, pick a tournament-winning team once, predict match outcomes and scores, and compete on a leaderboard. Admins enter final results which trigger point calculation.

---

## 1. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 14+ (App Router) | Single full-stack codebase |
| Auth | NextAuth.js (Auth.js) v5 | Google provider only |
| ORM / DB | Prisma + **SQLite** | File-based DB (`prisma/dev.db`) |
| External data | API-Football (api-sports.io / RapidAPI) | Fixtures sync |
| UI | React + Tailwind CSS | |
| Validation | Zod | All API inputs |
| Background sync | Vercel Cron or node-cron | Fixture refresh |

> SQLite note: fine for a single-instance deployment (VPS, Fly.io, Railway volume). It will NOT work on serverless platforms with ephemeral filesystems (Vercel) unless you use a mounted volume or swap to Turso (libSQL) — Prisma makes that a config change.

---

## 2. Functional Requirements

| # | Requirement | Points | Notes |
|---|---|---|---|
| R1 | Google login | — | No email/password. First login creates user. |
| R2 | Pick the winning team (tournament champion) | **6** | One-time pick, locked after first save (and after global deadline). Awarded when admin sets tournament winner. |
| R3 | List of games from API-Football | — | Synced into local DB; app reads from DB only. |
| R4 | User can see all defined games | — | Upcoming + finished, grouped by date/round. |
| R5 | Betting window: opens 1 week before kickoff, closes 2h before | — | **Both values configurable** (see §6). |
| R6 | One bet per match per user | — | DB unique constraint `(userId, fixtureId)`. |
| R7 | Predict outcome win/draw/lose | **1** | Stored as HOME / DRAW / AWAY. |
| R8 | Predict exact score | **+2** | Bonus on top of outcome point (exact score ⇒ 3 total). |
| R9 | User can update his bet | — | Unlimited edits while window is open. |
| R10 | Leaderboard | — | Total points, ranked, ties share rank. |
| R11 | Admin role: set result per game | — | Triggers scoring for that fixture. |
| R12 | SQLite database | — | Via Prisma. |

### Scoring rules (definitive)

- Correct outcome (1/X/2): **1 point**
- Exact score: **+2 points** (so an exact score always = 3 points, since exact score implies correct outcome)
- Wrong outcome: **0 points**
- Champion pick correct: **6 points**, added when admin finalizes the tournament winner
- Points are computed server-side when the admin saves a result. Re-saving a result must **recompute** (idempotent), not double-award.

---

## 3. Architecture

```
Browser ──► Next.js (App Router)
              ├── /app/(pages)        UI: games, my bets, leaderboard, admin
              ├── /app/api/*          REST route handlers (Zod-validated)
              ├── NextAuth (Google)   session via JWT cookie
              ├── Prisma ──► SQLite (dev.db)
              └── Sync job ──► API-Football (server-side only, key never exposed)
```

Principles:

- API-Football is called **only** from the server during sync; the app never calls it per-request (rate limits: free tier = 100 req/day).
- All bet validation (window open? already finished? score format?) happens server-side. UI disabling is cosmetic only.
- Times stored in UTC (ISO 8601); rendered in user's local timezone (`Intl.DateTimeFormat`). UAE audience ⇒ default `Asia/Dubai` for any server-rendered fallback.

### Suggested repo layout

```
/app
  /(public)/login
  /games            # R3, R4 — list + bet UI
  /my-bets
  /leaderboard      # R10
  /pick-winner      # R2
  /admin            # R11 — results entry, settings, sync
  /api
    /auth/[...nextauth]/route.ts
    /fixtures/route.ts
    /bets/route.ts
    /winner-pick/route.ts
    /leaderboard/route.ts
    /admin/results/route.ts
    /admin/settings/route.ts
    /admin/sync/route.ts
/lib
  auth.ts  prisma.ts  scoring.ts  betting-window.ts  api-football.ts  settings.ts
/prisma
  schema.prisma  seed.ts
```

---

## 4. Data Model (Prisma / SQLite)

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL") // file:./dev.db
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  USER
  ADMIN
}

enum Outcome {
  HOME
  DRAW
  AWAY
}

enum FixtureStatus {
  SCHEDULED   // NS
  LIVE        // 1H, HT, 2H, ET, P
  FINISHED    // FT, AET, PEN
  POSTPONED   // PST
  CANCELLED   // CANC, ABD, WO
}

model User {
  id            String      @id @default(cuid())
  email         String      @unique
  name          String?
  image         String?
  role          Role        @default(USER)
  createdAt     DateTime    @default(now())
  bets          Bet[]
  winnerPick    WinnerPick?
}

model Team {
  id           Int       @id            // API-Football team id
  name         String
  logoUrl      String?
  homeFixtures Fixture[] @relation("home")
  awayFixtures Fixture[] @relation("away")
  winnerPicks  WinnerPick[]
}

model Fixture {
  id          Int           @id          // API-Football fixture id
  homeTeamId  Int
  awayTeamId  Int
  homeTeam    Team          @relation("home", fields: [homeTeamId], references: [id])
  awayTeam    Team          @relation("away", fields: [awayTeamId], references: [id])
  kickoffAt   DateTime                   // UTC
  round       String?                    // e.g. "Group A - 1"
  status      FixtureStatus @default(SCHEDULED)
  homeScore   Int?                       // final, admin-confirmed
  awayScore   Int?
  resultSetAt DateTime?                  // when admin confirmed result
  bets        Bet[]

  @@index([kickoffAt])
}

model Bet {
  id           String   @id @default(cuid())
  userId       String
  fixtureId    Int
  user         User     @relation(fields: [userId], references: [id])
  fixture      Fixture  @relation(fields: [fixtureId], references: [id])
  outcome      Outcome                  // R7
  predHome     Int                      // R8 — predicted score
  predAway     Int
  points       Int?                     // null until scored
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([userId, fixtureId])         // R6 — one bet per match
  @@index([fixtureId])
}

model WinnerPick {
  id        String   @id @default(cuid())
  userId    String   @unique             // R2 — one pick ever
  teamId    Int
  user      User     @relation(fields: [userId], references: [id])
  team      Team     @relation(fields: [teamId], references: [id])
  points    Int?                         // 6 or 0 once tournament finalized
  createdAt DateTime @default(now())
}

model Setting {
  key   String @id                       // see §6
  value String
}
```

Design decisions:

- `outcome` and `predHome/predAway` are **two independent inputs** (product decision, §14.1). They are scored separately; do not derive one from the other. UI may show a soft "your score contradicts your 1/X/2" warning but must not block submission.
- `Bet.points` is persisted (not computed on read) so the leaderboard is a cheap aggregate and history survives rule changes.
- Tournament winner is stored in `Setting` (`tournament_winner_team_id`) rather than a separate table.

---

## 5. Betting Window Logic (R5, R9)

```
opensAt  = kickoffAt - BET_OPEN_BEFORE   (default 7 days)
closesAt = kickoffAt - BET_CLOSE_BEFORE  (default 2 hours)

canBet(now, fixture) =
  fixture.status == SCHEDULED
  && opensAt <= now < closesAt
```

- Create **and update** bets share the same check (`POST /api/bets` upserts).
- Enforce in the API handler in a transaction with the unique constraint; never trust the client.
- Edge cases: postponed fixture ⇒ window recomputes off new `kickoffAt` after sync; if a fixture goes LIVE early, status check blocks betting regardless of clock.

---

## 6. Configuration

`Setting` table (admin-editable via `/admin/settings`), env vars for secrets.

| Setting key | Default | Meaning |
|---|---|---|
| `bet_open_before_hours` | `168` (7 days) | Window opens N hours before kickoff |
| `bet_close_before_hours` | `2` | Window closes N hours before kickoff |
| `winner_pick_deadline` | tournament start (ISO) | After this, no champion picks |
| `tournament_winner_team_id` | — | Set by admin at tournament end; triggers R2 scoring |

| Env var | Example |
|---|---|
| `DATABASE_URL` | `file:./dev.db` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from Google Cloud Console |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://bet.privilee.ae` |
| `API_FOOTBALL_KEY` | from dashboard.api-football.com |
| `API_FOOTBALL_LEAGUE_ID` | e.g. `1` (FIFA World Cup) |
| `API_FOOTBALL_SEASON` | `2026` |
| `CRON_SECRET` | protects `/api/admin/sync` |

---

## 7. API-Football Integration (R3)

Base: `https://v3.football.api-sports.io` (header `x-apisports-key`) or via RapidAPI.

Sync job (cron, every 6–12h; manual trigger from admin panel):

1. `GET /teams?league={id}&season={season}` → upsert `Team`
2. `GET /fixtures?league={id}&season={season}` → upsert `Fixture` (id, kickoff, round, status mapping below)
3. Status mapping: `NS→SCHEDULED`, `1H/HT/2H/ET/P→LIVE`, `FT/AET/PEN→FINISHED`, `PST→POSTPONED`, `CANC/ABD/WO→CANCELLED`

Important:

- **Scores from the API are display-only.** Per R11, the *admin confirms* the official result — that confirmation (not the sync) awards points. (Optional enhancement: admin "accept API score" one-click.)
- Free tier = 100 requests/day ⇒ sync whole league in 2 calls; never call per fixture.
- Persist raw API ids as PKs to make re-sync idempotent.

---

## 8. REST API

All routes require a session unless noted. Admin routes require `role == ADMIN`. Validate bodies with Zod. Errors: `{ "error": { "code": "...", "message": "..." } }` with proper status codes.

| Method & path | Auth | Description |
|---|---|---|
| `GET /api/auth/*` | public | NextAuth (Google OAuth) |
| `GET /api/fixtures?filter=upcoming|finished|all` | user | Fixtures + my bet + window state (`opensAt`, `closesAt`, `canBet`) |
| `POST /api/bets` | user | Upsert bet `{fixtureId, outcome, predHome, predAway}` → 403 `BET_WINDOW_CLOSED` if outside window |
| `GET /api/bets/me` | user | My bets with points |
| `GET /api/winner-pick/teams` | user | Teams available for champion pick |
| `POST /api/winner-pick` | user | `{teamId}` → 409 `ALREADY_PICKED` if exists; 403 if past deadline |
| `GET /api/winner-pick/me` | user | My pick |
| `GET /api/leaderboard` | user | Ranked totals (see §10) |
| `POST /api/admin/results` | admin | `{fixtureId, homeScore, awayScore}` — **90-minute score** (§14.4) → sets FINISHED + **scores all bets** (transaction) |
| `POST /api/admin/tournament-winner` | admin | `{teamId}` → scores all winner picks |
| `GET/PUT /api/admin/settings` | admin | Read/update window config |
| `POST /api/admin/sync` | admin or `CRON_SECRET` | Trigger API-Football sync |

### Scoring routine (runs inside `POST /api/admin/results`)

```ts
function scoreBet(bet, fx): number {
  const actual = fx.homeScore > fx.awayScore ? 'HOME'
               : fx.homeScore < fx.awayScore ? 'AWAY' : 'DRAW';
  let pts = 0;
  if (bet.outcome === actual) pts += 1;                       // R7
  if (bet.predHome === fx.homeScore
      && bet.predAway === fx.awayScore) pts += 2;             // R8
  return pts;
}
// In one transaction: update fixture, then UPDATE all bets' points.
// Always recompute from scratch → safe for admin corrections.
```

---

## 9. Pages / UX

| Route | Who | Content |
|---|---|---|
| `/login` | public | "Sign in with Google" |
| `/games` | user | Fixtures grouped by date; per card: teams/logos, local kickoff time, window countdown, bet form (1/X/2 + score steppers) or locked state, result + earned points when finished |
| `/my-bets` | user | All my bets, status, points |
| `/pick-winner` | user | Team grid; confirm dialog ("cannot be changed"); locked view after pick |
| `/leaderboard` | user | Rank, avatar, name, match points, champion bonus, total; highlight me |
| `/admin` | admin | Results entry (with API score suggestion), settings form, sync button, set tournament winner |

UX rules: betting form disabled outside window with reason ("Opens Jun 12, 14:00" / "Closed — kickoff in 1h"); optimistic updates OK but reconcile with server response; show "bet saved/updated" toast (R9).

---

## 10. Leaderboard (R10)

```sql
SELECT u.id, u.name, u.image,
       COALESCE(SUM(b.points), 0)            AS match_points,
       COALESCE(wp.points, 0)                AS winner_points,
       COALESCE(SUM(b.points), 0) + COALESCE(wp.points, 0) AS total
FROM User u
LEFT JOIN Bet b         ON b.userId = u.id
LEFT JOIN WinnerPick wp ON wp.userId = u.id
GROUP BY u.id
ORDER BY total DESC,
         (SELECT AVG(strftime('%s', b2.updatedAt)) FROM Bet b2 WHERE b2.userId = u.id) ASC,  -- earlier bettor wins ties (§14.5)
         u.name ASC;
```

Tiebreaker (§14.5): equal totals are ordered by average bet submission time — the user who committed earlier ranks higher. Users with identical totals **and** no bets fall back to name. Display rank without sharing (1, 2, 3) since the tiebreaker is near-unique.

---

## 11. Auth & Authorization (R1, R11)

- NextAuth Google provider; JWT session strategy (no DB sessions needed).
- On first sign-in, create `User` with `role = USER`.
- Admin bootstrap: env `ADMIN_EMAILS=ha@privilee.ae,...` checked in the NextAuth `signIn`/`jwt` callback, or flip `role` manually in DB.
- Sign-in **restricted to `@privilee.ae`** (§14.2): pass `hd: "privilee.ae"` in the Google provider options AND reject any other domain in the `signIn` callback server-side. Non-privilee accounts get a friendly "use your Privilee account" error page.
- Middleware: `/admin/*` and `/api/admin/*` reject non-admins (403); all other app routes redirect unauthenticated → `/login`.

---

## 12. Setup & Run

```bash
git clone <repo> && cd privilee-bet
cp .env.example .env        # fill values from §6
npm install
npx prisma migrate dev      # creates SQLite db + tables
npx prisma db seed          # optional: settings defaults + admin user
npm run dev                 # http://localhost:3000
```

Google OAuth setup: Google Cloud Console → Credentials → OAuth client (Web) → authorized redirect URI `https://<host>/api/auth/callback/google` (and `http://localhost:3000/...` for dev).

Production: any Node host with a persistent disk (Railway/Fly/VPS + PM2). Back up `dev.db` (it's a single file). Run sync via cron hitting `/api/admin/sync` with `CRON_SECRET`.

---

## 13. Testing Checklist

- [ ] Bet rejected before window opens / after it closes (boundary: exactly ±0s)
- [ ] Second bet on same fixture **updates**, never duplicates (unique constraint race-safe)
- [ ] Bet rejected on LIVE/FINISHED/CANCELLED fixture even if clock says window open
- [ ] Scoring: outcome only = 1; exact score = 3; wrong = 0; admin re-save recomputes (no double points)
- [ ] Winner pick: second attempt → 409 (locked at first save, §14.3); after deadline → 403; correct pick awards exactly 6 once
- [ ] Login with non-@privilee.ae Google account rejected server-side (not just `hd` param)
- [ ] Tied totals ranked by earlier average bet time; knockout draw after 90' scores DRAW correctly
- [ ] Non-admin gets 403 on all `/api/admin/*`
- [ ] Leaderboard totals = sum of bet points + winner points; tie ranking correct
- [ ] Postponed fixture: window recomputed after kickoff change
- [ ] Changing `bet_close_before_hours` takes effect without restart
- [ ] API key never appears in client bundle / network tab

---

## 14. Product Decisions (resolved 2026-06-10)

1. **Outcome vs score: two separate inputs.** User selects 1/X/2 AND a score independently; each scored separately (1 pt + 2 pts). No consistency enforcement — a contradictory combo is allowed (UI may show a soft warning).
2. **Login restricted to `@privilee.ae`.** Google `hd=privilee.ae` param + mandatory server-side email-domain check in the NextAuth `signIn` callback (the `hd` param alone is not security).
3. **Champion pick locked at first save.** No edits, even before the deadline. Confirm dialog must make this explicit.
4. **Knockout games score on the 90-minute result** (incl. stoppage, excl. ET/pens). Admin enters the 90-minute score; a knockout draw after 90' scores DRAW bets as correct.
5. **Leaderboard tiebreaker: earlier bettor wins.** Tied totals are ranked by average bet submission time (`Bet.updatedAt`, ascending — earlier average wins). Updating a bet refreshes its timestamp, so early commitment is rewarded. Final fallback: name ASC.

---

## 15. Gamification & Fun Layer (v1.1 candidates)

Cheap-to-build, high-impact first (all fit the existing schema with small additions):

### Tier 1 — ship with v1 (low effort)

| Feature | Why it's fun | Implementation |
|---|---|---|
| **Streaks** 🔥 | "3 correct in a row" creates daily pull | Compute from `Bet.points` ordered by kickoff; show flame badge on leaderboard |
| **Exact-score celebration** | Rare event (worth 3 pts) deserves confetti + shareable card | Client-side confetti on result reveal; "I nailed 2-1!" share image |
| **Rank movement arrows** | ▲2 / ▼1 since last matchday drives rivalry | Snapshot leaderboard per matchday (`LeaderboardSnapshot` table or computed) |
| **Pundit titles by rank** | "Oracle", "Tactician", "Benchwarmer" (bottom 3) — friendly trash talk | Pure UI mapping from rank percentile |
| **Deadline FOMO** | "⏳ 4 bets missing — closes in 3h" nudge banner | Query: open fixtures without my bet |

### Tier 2 — badges & achievements (medium)

`Badge` + `UserBadge` tables; awarded inside the scoring transaction:

- **Sniper** — first exact score · **Hot Streak** — 5 correct in a row · **Against the Odds** — correct when <20% of users picked that outcome · **Early Bird** — bet within 1h of window opening · **Full House** — bet on every game in a round · **Prophet** — champion pick correct
- Profile page shows badge wall; locked badges greyed out (collection instinct).

### Tier 3 — social & competitive (bigger)

- **Private mini-leagues**: invite-code groups (e.g. per Privilee team/department) with their own leaderboard — biggest engagement multiplier in prediction games.
- **Community pick %**: after window closes, show "68% picked France" — makes upsets delicious.
- **Power-ups (one each per tournament)**: *Double Down* (2× points on one match), *Insurance* (one wrong bet refunded as 1 pt). Adds strategy with one `PowerUpUse` table.
- **Weekly matchday winner**: separate per-round mini-prize, so newcomers can still win something even if behind overall.

### Design principles

- Never gate core betting behind gamification; it's seasoning, not the meal.
- Award everything inside the existing scoring transaction → no separate jobs, no drift.
- Keep it social-positive (titles tease ranks, never individuals' bad picks publicly).

---

## 16. Estimated Effort

| Phase | Scope | Est. |
|---|---|---|
| 1 | Project setup, Prisma schema, Google auth, roles | 1–2 d |
| 2 | API-Football sync + games list UI | 1–2 d |
| 3 | Betting (window logic, upsert, validation) | 2 d |
| 4 | Winner pick + leaderboard | 1 d |
| 5 | Admin panel (results, settings, sync, winner) | 1–2 d |
| 6 | Testing, polish, deploy | 1–2 d |
| | **Total (core)** | **~7–11 days** |
| +G1 | Gamification Tier 1 (streaks, titles, FOMO, confetti) | +1–2 d |
| +G2 | Badges system | +1–2 d |
| +G3 | Mini-leagues, pick %, power-ups | +3–4 d |
