// Fixture data source as a swappable adapter (build-design): the app reads fixtures
// from the local DB only; providers fill that DB during sync. SeedProvider is the
// offline default (zero external deps for QA); TheSportsDbProvider hits a free,
// key-less public API. API-Football can be added later as a third adapter.
import type { FixtureStatus } from "@/lib/types";
import { prisma } from "@/lib/prisma";
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

  async fetchTeams(): Promise<ProviderTeam[]> {
    // lookup_all_teams returns every team in a league for the current season.
    const data = await this.get<{ teams: SportsDbTeam[] | null }>(
      `lookup_all_teams.php?id=${encodeURIComponent(this.leagueId!)}`,
    );
    const teams = data.teams ?? [];
    return teams
      .filter((t) => t.idTeam)
      .map((t) => ({
        id: Number(t.idTeam),
        name: t.strTeam ?? `Team ${t.idTeam}`,
        logoUrl: t.strTeamBadge ?? t.strTeamLogo ?? null,
      }));
  }

  async fetchFixtures(): Promise<ProviderFixture[]> {
    // eventsseason returns the full season schedule in one call (idempotent re-sync).
    const data = await this.get<{ events: SportsDbEvent[] | null }>(
      `eventsseason.php?id=${encodeURIComponent(this.leagueId!)}&s=${encodeURIComponent(
        this.season!,
      )}`,
    );
    const events = data.events ?? [];
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

interface SportsDbTeam {
  idTeam?: string;
  strTeam?: string;
  strTeamBadge?: string;
  strTeamLogo?: string;
}

interface SportsDbEvent {
  idEvent?: string;
  idHomeTeam?: string;
  idAwayTeam?: string;
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

// --- Selection + sync ------------------------------------------------------------

export function getProvider(): FixturesProvider {
  const name = (process.env.FIXTURES_PROVIDER || "seed").toLowerCase();
  switch (name) {
    case "thesportsdb":
      return new TheSportsDbProvider();
    case "seed":
      return new SeedProvider();
    default:
      throw new Error(`Unknown FIXTURES_PROVIDER: "${name}" (expected "seed" or "thesportsdb")`);
  }
}

// Upsert teams then fixtures, idempotently, preserving admin-confirmed results:
// once a fixture is FINISHED, sync must NOT clobber its score/status (handoff §7 —
// scores are admin-authoritative, the sync feed is display-only). Returns counts.
export async function syncFixtures(
  provider: FixturesProvider = getProvider(),
): Promise<{ teams: number; fixtures: number }> {
  const [teams, fixtures] = await Promise.all([
    provider.fetchTeams(),
    provider.fetchFixtures(),
  ]);

  // Teams first so fixture FKs resolve.
  for (const t of teams) {
    await prisma.team.upsert({
      where: { id: t.id },
      update: { name: t.name, logoUrl: t.logoUrl },
      create: { id: t.id, name: t.name, logoUrl: t.logoUrl },
    });
  }

  // Which fixtures are already finalized by the admin? Don't overwrite those.
  const finalized = new Set(
    (
      await prisma.fixture.findMany({
        where: { status: "FINISHED" },
        select: { id: true },
      })
    ).map((f) => f.id),
  );

  let fixtureCount = 0;
  for (const f of fixtures) {
    if (finalized.has(f.id)) {
      // Preserve admin-confirmed score/status; nothing to update.
      fixtureCount++;
      continue;
    }
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
    fixtureCount++;
  }

  return { teams: teams.length, fixtures: fixtureCount };
}
