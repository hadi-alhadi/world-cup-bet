// Fixture data source as a swappable adapter (build-design): the app reads fixtures
// from the local DB only; providers fill that DB during sync. SeedProvider is the
// offline default (zero external deps for QA); TheSportsDbProvider hits a free,
// key-less public API. API-Football can be added later as a third adapter.
import type { FixtureStatus } from "@/lib/types";
import { prisma } from "@/lib/prisma";
import { applyFeedResult, type FeedDuration } from "@/lib/scoring";
import { TEAMS, FIXTURES } from "@/prisma/seed-data";

export interface ProviderTeam {
  id: number;
  name: string;
  logoUrl: string | null;
}

export interface ProviderFixture {
  id: number;
  homeTeamId: number;
  awayTeamId: number;
  kickoffAt: Date;
  round: string;
  status: FixtureStatus;
  // Result fields — only set by providers that report scores (football-data.org), and
  // only when the match is FINISHED. Drives auto-import (handoff §14.4 via applyFeedResult).
  homeScore?: number | null;
  awayScore?: number | null;
  duration?: "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT";
}

export interface FixturesProvider {
  fetchTeams(): Promise<ProviderTeam[]>;
  fetchFixtures(): Promise<ProviderFixture[]>;
}

// --- SeedProvider: deterministic offline data from prisma/seed-data.ts ----------

export class SeedProvider implements FixturesProvider {
  async fetchTeams(): Promise<ProviderTeam[]> {
    return TEAMS.map((t) => ({ id: t.id, name: t.name, logoUrl: t.logoUrl }));
  }

  async fetchFixtures(): Promise<ProviderFixture[]> {
    return FIXTURES.map((f) => ({
      id: f.id,
      homeTeamId: f.homeTeamId,
      awayTeamId: f.awayTeamId,
      kickoffAt: f.kickoffAt,
      round: f.round,
      status: f.status as FixtureStatus,
    }));
  }
}

// --- TheSportsDbProvider: free public API (https://www.thesportsdb.com) ----------

// TheSportsDB strStatus strings → our FixtureStatus. Their feed is less granular than
// API-Football; we map conservatively and default unknowns to SCHEDULED.
function mapSportsDbStatus(raw: string | null | undefined): FixtureStatus {
  const s = (raw ?? "").toUpperCase().trim();
  if (["NS", "NOT STARTED", "TBD", ""].includes(s)) return "SCHEDULED";
  if (["FT", "AET", "PEN", "MATCH FINISHED", "FINISHED"].includes(s)) return "FINISHED";
  if (["1H", "2H", "HT", "ET", "P", "LIVE", "IN PLAY"].includes(s)) return "LIVE";
  if (["PST", "POSTPONED"].includes(s)) return "POSTPONED";
  if (["CANC", "CANCELLED", "ABD", "WO", "AWARDED"].includes(s)) return "CANCELLED";
  return "SCHEDULED";
}

export class TheSportsDbProvider implements FixturesProvider {
  private key = process.env.THESPORTSDB_KEY || "3"; // "3" is their public test key
  private leagueId = process.env.THESPORTSDB_LEAGUE_ID;
  private season = process.env.THESPORTSDB_SEASON;
  private base: string;

  constructor() {
    if (!this.leagueId || !this.season) {
      throw new Error(
        "TheSportsDbProvider requires THESPORTSDB_LEAGUE_ID and THESPORTSDB_SEASON env vars",
      );
    }
    this.base = `https://www.thesportsdb.com/api/v1/json/${this.key}`;
  }

  private async get<T>(pathAndQuery: string): Promise<T> {
    const url = `${this.base}/${pathAndQuery}`;
    let res: Response;
    try {
      res = await fetch(url, { cache: "no-store" });
    } catch (cause) {
      throw new Error(`TheSportsDB request failed (network): ${url}`, { cause });
    }
    if (!res.ok) {
      throw new Error(`TheSportsDB request failed: ${res.status} ${res.statusText} for ${url}`);
    }
    return (await res.json()) as T;
  }

  // eventsseason returns the full season schedule in one call. We cache it because BOTH
  // fetchTeams and fetchFixtures derive from it — see fetchTeams for why.
  private eventsPromise?: Promise<SportsDbEvent[]>;
  private loadEvents(): Promise<SportsDbEvent[]> {
    if (!this.eventsPromise) {
      this.eventsPromise = this.get<{ events: SportsDbEvent[] | null }>(
        `eventsseason.php?id=${encodeURIComponent(this.leagueId!)}&s=${encodeURIComponent(
          this.season!,
        )}`,
      ).then((d) => d.events ?? []);
    }
    return this.eventsPromise;
  }

  async fetchTeams(): Promise<ProviderTeam[]> {
    // IMPORTANT: TheSportsDB's lookup_all_teams.php is unreliable for the World Cup league
    // (it returns unrelated club teams whose ids don't match the fixtures, causing FK
    // failures). Instead we derive the team set from the season's events themselves, so
    // team ids are guaranteed consistent with the fixtures that reference them. Each event
    // carries the team name + badge for both sides.
    const events = await this.loadEvents();
    const byId = new Map<number, ProviderTeam>();
    for (const e of events) {
      if (e.idHomeTeam) {
        byId.set(Number(e.idHomeTeam), {
          id: Number(e.idHomeTeam),
          name: e.strHomeTeam ?? `Team ${e.idHomeTeam}`,
          logoUrl: e.strHomeTeamBadge ?? null,
        });
      }
      if (e.idAwayTeam) {
        byId.set(Number(e.idAwayTeam), {
          id: Number(e.idAwayTeam),
          name: e.strAwayTeam ?? `Team ${e.idAwayTeam}`,
          logoUrl: e.strAwayTeamBadge ?? null,
        });
      }
    }
    return [...byId.values()];
  }

  async fetchFixtures(): Promise<ProviderFixture[]> {
    const events = await this.loadEvents();
    const out: ProviderFixture[] = [];
    for (const e of events) {
      if (!e.idEvent || !e.idHomeTeam || !e.idAwayTeam) continue;
      const kickoffAt = parseSportsDbKickoff(e);
      if (!kickoffAt) continue;
      out.push({
        id: Number(e.idEvent),
        homeTeamId: Number(e.idHomeTeam),
        awayTeamId: Number(e.idAwayTeam),
        kickoffAt,
        round: e.strRound ? `Round ${e.strRound}` : e.strEvent ?? "Fixture",
        status: mapSportsDbStatus(e.strStatus),
      });
    }
    return out;
  }
}

interface SportsDbEvent {
  idEvent?: string;
  idHomeTeam?: string;
  idAwayTeam?: string;
  strHomeTeam?: string;
  strAwayTeam?: string;
  strHomeTeamBadge?: string;
  strAwayTeamBadge?: string;
  strEvent?: string;
  strRound?: string;
  strStatus?: string;
  strTimestamp?: string; // ISO-ish, preferred
  dateEvent?: string; // YYYY-MM-DD (UTC)
  strTime?: string; // HH:MM:SS (UTC)
}

function parseSportsDbKickoff(e: SportsDbEvent): Date | null {
  if (e.strTimestamp) {
    const d = new Date(e.strTimestamp);
    if (!isNaN(d.getTime())) return d;
  }
  if (e.dateEvent) {
    const time = e.strTime && /^\d{2}:\d{2}/.test(e.strTime) ? e.strTime : "00:00:00";
    const d = new Date(`${e.dateEvent}T${time}Z`); // their times are UTC
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

// --- ApiFootballProvider: api-sports.io (handoff §7) -----------------------------
// CALL BUDGET: a single GET /fixtures?league&season returns the WHOLE league schedule
// WITH each fixture's teams embedded (id, name, logo). We derive teams from that one
// response instead of a second /teams call — so a full sync costs exactly 1 request.
// With the 8h cron that's ~3 requests/day, well under the free tier's 100/day.
// NOTE: the free plan only exposes seasons 2022–2024 (2025+/World-Cup-2026 need a paid
// plan). Point API_FOOTBALL_SEASON at an accessible season, e.g. 2022 (WC Qatar, 64 games).

function mapApiFootballStatus(short: string | undefined): FixtureStatus {
  switch ((short ?? "").toUpperCase()) {
    case "NS":
    case "TBD":
      return "SCHEDULED";
    case "1H":
    case "HT":
    case "2H":
    case "ET":
    case "BT":
    case "P":
    case "LIVE":
    case "INT":
      return "LIVE";
    case "FT":
    case "AET":
    case "PEN":
      return "FINISHED";
    case "PST":
      return "POSTPONED";
    case "CANC":
    case "ABD":
    case "AWD":
    case "WO":
      return "CANCELLED";
    default:
      return "SCHEDULED";
  }
}

interface AfTeam {
  id?: number;
  name?: string;
  logo?: string;
}
interface AfFixture {
  fixture?: { id?: number; date?: string; status?: { short?: string } };
  league?: { round?: string };
  teams?: { home?: AfTeam; away?: AfTeam };
}

export class ApiFootballProvider implements FixturesProvider {
  private key = process.env.API_FOOTBALL_KEY;
  private leagueId = process.env.API_FOOTBALL_LEAGUE_ID || "1"; // 1 = FIFA World Cup
  private season = process.env.API_FOOTBALL_SEASON;
  private base = "https://v3.football.api-sports.io";

  constructor() {
    if (!this.key) throw new Error("ApiFootballProvider requires API_FOOTBALL_KEY");
    if (!this.season) throw new Error("ApiFootballProvider requires API_FOOTBALL_SEASON");
  }

  // One network call, memoized, shared by fetchTeams + fetchFixtures (1 request/sync).
  private fixturesPromise?: Promise<AfFixture[]>;
  private loadFixtures(): Promise<AfFixture[]> {
    if (!this.fixturesPromise) {
      const url = `${this.base}/fixtures?league=${encodeURIComponent(
        this.leagueId,
      )}&season=${encodeURIComponent(this.season!)}`;
      this.fixturesPromise = fetch(url, {
        headers: { "x-apisports-key": this.key! },
        cache: "no-store",
      }).then(async (res) => {
        if (!res.ok) {
          throw new Error(`API-Football request failed: ${res.status} ${res.statusText}`);
        }
        const data = (await res.json()) as { response?: AfFixture[]; errors?: unknown };
        // API-Football returns HTTP 200 with a populated `errors` field on plan/param issues.
        const errs = data.errors;
        const hasErrors = Array.isArray(errs)
          ? errs.length > 0
          : !!errs && typeof errs === "object" && Object.keys(errs).length > 0;
        if (hasErrors) throw new Error(`API-Football error: ${JSON.stringify(errs)}`);
        return data.response ?? [];
      });
    }
    return this.fixturesPromise;
  }

  async fetchTeams(): Promise<ProviderTeam[]> {
    const fixtures = await this.loadFixtures();
    const byId = new Map<number, ProviderTeam>();
    for (const f of fixtures) {
      for (const t of [f.teams?.home, f.teams?.away]) {
        if (t?.id) byId.set(t.id, { id: t.id, name: t.name ?? `Team ${t.id}`, logoUrl: t.logo ?? null });
      }
    }
    return [...byId.values()];
  }

  async fetchFixtures(): Promise<ProviderFixture[]> {
    const fixtures = await this.loadFixtures();
    const out: ProviderFixture[] = [];
    for (const f of fixtures) {
      const id = f.fixture?.id;
      const home = f.teams?.home?.id;
      const away = f.teams?.away?.id;
      if (!id || !home || !away || !f.fixture?.date) continue;
      const kickoffAt = new Date(f.fixture.date);
      if (isNaN(kickoffAt.getTime())) continue;
      out.push({
        id,
        homeTeamId: home,
        awayTeamId: away,
        kickoffAt,
        round: f.league?.round ?? "Fixture",
        status: mapApiFootballStatus(f.fixture.status?.short),
      });
    }
    return out;
  }
}

// --- FootballDataProvider: football-data.org v4 ----------------------------------
// The only free source with the COMPLETE FIFA World Cup 2026 (48 teams, 104 matches),
// including results once matches finish (score.fullTime). Two cheap calls per sync:
// /competitions/{comp}/teams (with crests) + /competitions/{comp}/matches. Free tier =
// 10 req/min; with the 8h cron that's ~6 req/day. Auth header: X-Auth-Token.

function mapFootballDataStatus(status: string | undefined): FixtureStatus {
  switch ((status ?? "").toUpperCase()) {
    case "SCHEDULED":
    case "TIMED":
      return "SCHEDULED";
    case "IN_PLAY":
    case "PAUSED":
      return "LIVE";
    case "FINISHED":
    case "AWARDED":
      return "FINISHED";
    case "POSTPONED":
    case "SUSPENDED":
      return "POSTPONED";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return "SCHEDULED";
  }
}

function footballDataRound(m: FdMatch): string {
  if (m.group) return m.group.replace(/^GROUP_/, "Group ");
  if (m.stage) return m.stage.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return "Fixture";
}

interface FdTeam {
  id?: number;
  name?: string;
  crest?: string;
}
interface FdScore {
  duration?: string; // REGULAR | EXTRA_TIME | PENALTY_SHOOTOUT
  fullTime?: { home?: number | null; away?: number | null };
}
interface FdMatch {
  id?: number;
  utcDate?: string;
  status?: string;
  stage?: string;
  group?: string;
  homeTeam?: FdTeam;
  awayTeam?: FdTeam;
  score?: FdScore;
}

export class FootballDataProvider implements FixturesProvider {
  private key = process.env.FOOTBALLDATA_KEY;
  private competition = process.env.FOOTBALLDATA_COMPETITION || "WC"; // WC = FIFA World Cup
  private season = process.env.FOOTBALLDATA_SEASON; // optional start-year; default = current
  private base = "https://api.football-data.org/v4";

  constructor() {
    if (!this.key) throw new Error("FootballDataProvider requires FOOTBALLDATA_KEY");
  }

  private async get<T>(path: string): Promise<T> {
    const sep = path.includes("?") ? "&" : "?";
    const url = `${this.base}${path}${this.season ? `${sep}season=${encodeURIComponent(this.season)}` : ""}`;
    const res = await fetch(url, { headers: { "X-Auth-Token": this.key! }, cache: "no-store" });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`football-data.org request failed: ${res.status} ${res.statusText} ${body}`);
    }
    return (await res.json()) as T;
  }

  async fetchTeams(): Promise<ProviderTeam[]> {
    const data = await this.get<{ teams?: FdTeam[] }>(`/competitions/${this.competition}/teams`);
    return (data.teams ?? [])
      .filter((t) => t.id)
      .map((t) => ({ id: t.id!, name: t.name ?? `Team ${t.id}`, logoUrl: t.crest ?? null }));
  }

  async fetchFixtures(): Promise<ProviderFixture[]> {
    const data = await this.get<{ matches?: FdMatch[] }>(`/competitions/${this.competition}/matches`);
    const out: ProviderFixture[] = [];
    for (const m of data.matches ?? []) {
      const home = m.homeTeam?.id;
      const away = m.awayTeam?.id;
      // Knockout matches can have null teams until the bracket fills in — skip those.
      if (!m.id || !home || !away || !m.utcDate) continue;
      const kickoffAt = new Date(m.utcDate);
      if (isNaN(kickoffAt.getTime())) continue;
      const status = mapFootballDataStatus(m.status);
      const ft = m.score?.fullTime;
      const duration = m.score?.duration as ProviderFixture["duration"] | undefined;
      out.push({
        id: m.id,
        homeTeamId: home,
        awayTeamId: away,
        kickoffAt,
        round: footballDataRound(m),
        status,
        // Carry the result only for finished matches; applyFeedResult enforces the 90' rule.
        homeScore: status === "FINISHED" ? ft?.home ?? null : null,
        awayScore: status === "FINISHED" ? ft?.away ?? null : null,
        duration,
      });
    }
    return out;
  }
}

// --- Selection + sync ------------------------------------------------------------

export function getProvider(): FixturesProvider {
  const name = (process.env.FIXTURES_PROVIDER || "seed").toLowerCase();
  switch (name) {
    case "footballdata":
      return new FootballDataProvider();
    case "apifootball":
      return new ApiFootballProvider();
    case "thesportsdb":
      return new TheSportsDbProvider();
    case "seed":
      return new SeedProvider();
    default:
      throw new Error(
        `Unknown FIXTURES_PROVIDER: "${name}" (expected "seed", "thesportsdb", "apifootball", or "footballdata")`,
      );
  }
}

const SYNC_LAST_KEY = "last_sync_at";

export interface SyncResult {
  teams: number;
  fixtures: number;
  scored?: number; // results auto-imported & bets scored (REGULAR matches)
  manual?: number; // ET/penalty matches flagged for admin 90' entry
  skipped?: boolean;
}

// Upsert teams + fixtures and auto-import results, idempotently. Preserves resolved
// fixtures (admin-confirmed OR already auto-scored OR flagged for manual entry) so a
// re-sync never clobbers them (handoff §7 — scores are authoritative once set).
//
// opts.skipTeams: skip the teams call/upsert (teams are static during a tournament — used
//   by the per-minute loop to halve API calls).
// opts.force: bypass the SYNC_MIN_INTERVAL_MINUTES quota guard.
export async function syncFixtures(
  provider: FixturesProvider = getProvider(),
  opts: { force?: boolean; skipTeams?: boolean } = {},
): Promise<SyncResult> {
  const minMinutes = Number(process.env.SYNC_MIN_INTERVAL_MINUTES || 0);
  if (!opts.force && minMinutes > 0) {
    const last = await prisma.setting.findUnique({ where: { key: SYNC_LAST_KEY } });
    const lastMs = last ? new Date(last.value).getTime() : NaN;
    if (!isNaN(lastMs) && Date.now() - lastMs < minMinutes * 60_000) {
      const [teams, fixtures] = await Promise.all([prisma.team.count(), prisma.fixture.count()]);
      return { teams, fixtures, skipped: true };
    }
  }

  // Teams first so fixture FKs resolve (unless skipping — teams already present).
  let teamCount: number;
  if (opts.skipTeams) {
    teamCount = await prisma.team.count();
  } else {
    const teams = await provider.fetchTeams();
    for (const t of teams) {
      await prisma.team.upsert({
        where: { id: t.id },
        update: { name: t.name, logoUrl: t.logoUrl },
        create: { id: t.id, name: t.name, logoUrl: t.logoUrl },
      });
    }
    teamCount = teams.length;
  }

  const fixtures = await provider.fetchFixtures();

  // A fixture is "resolved" — and must not be re-processed/clobbered — once it has a
  // score (admin or auto) OR is flagged for manual entry. A FINISHED fixture without a
  // score and not flagged is NOT resolved: we still try to import its result below.
  const resolved = new Set(
    (
      await prisma.fixture.findMany({
        where: { OR: [{ homeScore: { not: null } }, { needsManualResult: true }] },
        select: { id: true },
      })
    ).map((f) => f.id),
  );

  let fixtureCount = 0;
  let scored = 0;
  let manual = 0;
  for (const f of fixtures) {
    fixtureCount++;
    if (resolved.has(f.id)) continue; // leave finalized results untouched

    await prisma.fixture.upsert({
      where: { id: f.id },
      update: {
        homeTeamId: f.homeTeamId,
        awayTeamId: f.awayTeamId,
        kickoffAt: f.kickoffAt,
        round: f.round,
        status: f.status,
      },
      create: {
        id: f.id,
        homeTeamId: f.homeTeamId,
        awayTeamId: f.awayTeamId,
        kickoffAt: f.kickoffAt,
        round: f.round,
        status: f.status,
      },
    });

    // Auto-import a freshly-finished result when the feed provides one (§14.4 enforced
    // by applyFeedResult: REGULAR -> score now; ET/penalties -> flag for admin).
    if (f.status === "FINISHED" && f.homeScore != null && f.awayScore != null) {
      const outcome = await applyFeedResult(
        f.id,
        f.homeScore,
        f.awayScore,
        (f.duration ?? "REGULAR") as FeedDuration,
      );
      if (outcome === "scored") scored++;
      else manual++;
    }
  }

  // Record sync time for the quota-guard throttle above.
  const now = new Date().toISOString();
  await prisma.setting.upsert({
    where: { key: SYNC_LAST_KEY },
    update: { value: now },
    create: { key: SYNC_LAST_KEY, value: now },
  });

  return { teams: teamCount, fixtures: fixtureCount, scored, manual };
}
