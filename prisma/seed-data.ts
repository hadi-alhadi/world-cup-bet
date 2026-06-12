// Offline seed data for the default SeedProvider (build-design: zero external deps).
// Kickoff times are computed from a FIXED base so QA exercises every window state
// deterministically. With default settings (open 168h / close 2h before kickoff):
//   OPEN now      => kickoff ~2 days out  (open since 5 days ago, closes in ~2 days)
//   NOT_OPEN_YET  => kickoff ~10 days out (opens in ~3 days)
//   CLOSED        => kickoff ~1h out, still SCHEDULED (window shut 1h ago)
//   LIVE / FINISHED => status overrides the clock regardless of window math.
// The base is "now" at seed time, so these window states stay correct whenever the seed
// runs (a fixed past date would drift out of its windows as real time advances).

export interface SeedTeam {
  id: number;
  name: string;
  logoUrl: string | null;
}

export interface SeedFixture {
  id: number;
  homeTeamId: number;
  awayTeamId: number;
  kickoffAt: Date;
  round: string; // display: group (e.g. "Group A") or stage
  roundKey: string; // betting round bucket (whole round opens together)
  status: "SCHEDULED" | "LIVE" | "FINISHED" | "POSTPONED" | "CANCELLED";
  homeScore?: number;
  awayScore?: number;
}

// Reference instant = seed time. All relative offsets derive from this, so window states
// (OPEN/CLOSED/NOT_OPEN_YET) are correct relative to whenever the seed is run.
export const SEED_BASE = new Date();

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const at = (ms: number) => new Date(SEED_BASE.getTime() + ms);

// flagcdn provides stable, key-less country flag SVGs — a reasonable team "logo".
const flag = (code: string) => `https://flagcdn.com/${code}.svg`;

export const TEAMS: SeedTeam[] = [
  { id: 100, name: "Brazil", logoUrl: flag("br") },
  { id: 101, name: "France", logoUrl: flag("fr") },
  { id: 102, name: "Argentina", logoUrl: flag("ar") },
  { id: 103, name: "Germany", logoUrl: flag("de") },
  { id: 104, name: "Spain", logoUrl: flag("es") },
  { id: 105, name: "England", logoUrl: flag("gb-eng") },
  { id: 106, name: "Portugal", logoUrl: flag("pt") },
  { id: 107, name: "Netherlands", logoUrl: flag("nl") },
];

// round = group (display); roundKey = betting round (whole round opens 48h before its
// earliest kickoff). Round 1 games sit in the past/closing; Round 2 games are the OPEN
// set (earliest ~2 days out => opens ~now); Quarter-finals are NOT_OPEN_YET (~10 days out).
export const FIXTURES: SeedFixture[] = [
  // --- Group Stage · Round 1 (two FINISHED, one LIVE, one CLOSED) ---
  {
    id: 1000,
    homeTeamId: 100, // Brazil
    awayTeamId: 101, // France
    kickoffAt: at(-5 * DAY),
    round: "Group A",
    roundKey: "Group Stage · Round 1",
    status: "FINISHED",
    homeScore: 2,
    awayScore: 1,
  },
  {
    id: 1001,
    homeTeamId: 102, // Argentina
    awayTeamId: 103, // Germany
    kickoffAt: at(-4 * DAY),
    round: "Group B",
    roundKey: "Group Stage · Round 1",
    status: "FINISHED",
    homeScore: 0,
    awayScore: 0,
  },
  {
    id: 1002,
    homeTeamId: 104, // Spain
    awayTeamId: 105, // England
    kickoffAt: at(-1 * HOUR),
    round: "Group C",
    roundKey: "Group Stage · Round 1",
    status: "LIVE",
  },
  {
    id: 1003,
    homeTeamId: 106, // Portugal
    awayTeamId: 107, // Netherlands
    kickoffAt: at(1 * HOUR),
    round: "Group D",
    roundKey: "Group Stage · Round 1",
    status: "SCHEDULED",
  },
  // --- Group Stage · Round 2 (the OPEN set — opens together ~2 days before kickoff) ---
  {
    id: 1004,
    homeTeamId: 100, // Brazil
    awayTeamId: 102, // Argentina
    kickoffAt: at(2 * DAY),
    round: "Group A",
    roundKey: "Group Stage · Round 2",
    status: "SCHEDULED",
  },
  {
    id: 1005,
    homeTeamId: 101, // France
    awayTeamId: 104, // Spain
    kickoffAt: at(2 * DAY + 3 * HOUR),
    round: "Group B",
    roundKey: "Group Stage · Round 2",
    status: "SCHEDULED",
  },
  {
    id: 1006,
    homeTeamId: 105, // England
    awayTeamId: 106, // Portugal
    kickoffAt: at(3 * DAY),
    round: "Group C",
    roundKey: "Group Stage · Round 2",
    status: "SCHEDULED",
  },
  {
    id: 1009,
    homeTeamId: 102, // Argentina
    awayTeamId: 106, // Portugal
    kickoffAt: at(6 * DAY),
    round: "Group D",
    roundKey: "Group Stage · Round 2",
    status: "POSTPONED",
  },
  // --- Quarter-finals (NOT_OPEN_YET — round opens ~2 days before its first game) ---
  {
    id: 1007,
    homeTeamId: 103, // Germany
    awayTeamId: 107, // Netherlands
    kickoffAt: at(10 * DAY),
    round: "Quarter-finals",
    roundKey: "Quarter-finals",
    status: "SCHEDULED",
  },
  {
    id: 1008,
    homeTeamId: 100, // Brazil
    awayTeamId: 104, // Spain
    kickoffAt: at(11 * DAY),
    round: "Quarter-finals",
    roundKey: "Quarter-finals",
    status: "SCHEDULED",
  },
];
