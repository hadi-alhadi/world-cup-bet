// Shared DTOs and types used across API routes and UI.
// SQLite has no enums, so these string unions are the source of truth (enforced by Zod
// at the API boundary). Prisma stores the underlying columns as String.
export type Role = "USER" | "ADMIN";
export type Outcome = "HOME" | "DRAW" | "AWAY";
export type FixtureStatus =
  | "SCHEDULED"
  | "LIVE"
  | "FINISHED"
  | "POSTPONED"
  | "CANCELLED";

export type ApiError = { error: { code: string; message: string } };

export interface WindowState {
  opensAt: string; // ISO
  closesAt: string; // ISO
  canBet: boolean;
  reason: "OPEN" | "NOT_OPEN_YET" | "CLOSED" | "NOT_SCHEDULED";
}

export interface TeamDTO {
  id: number;
  name: string;
  logoUrl: string | null;
}

export interface MyBetDTO {
  outcome: Outcome;
  predHome: number;
  predAway: number;
  points: number | null;
  updatedAt: string;
}

export interface FixtureDTO {
  id: number;
  homeTeam: TeamDTO;
  awayTeam: TeamDTO;
  kickoffAt: string; // ISO UTC
  round: string | null;
  roundKey: string | null; // betting round bucket (whole round opens together)
  status: FixtureStatus;
  homeScore: number | null;
  awayScore: number | null;
  window: WindowState;
  myBet: MyBetDTO | null;
  // Set when a knockout was decided after 90' (ET/penalties) and the admin still needs to
  // enter the 90-minute score (§14.4). resultDuration is the feed's match duration.
  needsManualResult: boolean;
  resultDuration: string | null;
  // Community pick distribution — only revealed once the betting window has CLOSED
  // (null while open, so it can't influence live bets). Counts of each outcome.
  communityPicks: CommunityPicks | null;
  // The Dice bot's prediction for this fixture (null if Dice hasn't bet on it).
  dicePick: DicePick | null;
}

export interface DicePick {
  outcome: Outcome;
  predHome: number;
  predAway: number;
}

export interface CommunityPicks {
  home: number;
  draw: number;
  away: number;
  total: number;
}

export interface LeaderboardRow {
  userId: string;
  name: string | null;
  image: string | null;
  matchPoints: number;
  winnerPoints: number;
  total: number;
  rank: number;
  streak: number; // current consecutive correct (>=1 pt) by kickoff order
  title: string; // pundit title by rank percentile
  badges: string[]; // earned badge keys (see lib/badges.ts)
  pickedTeam: TeamDTO | null; // the user's champion pick, shown next to their avatar
  isMe?: boolean;
}

// Per-round mini-leaderboard row (Leaderboard round tabs, Tier 3).
export interface RoundStanding {
  userId: string;
  name: string | null;
  image: string | null;
  points: number;
  rank: number; // position within the round (top2/bottom2 rank humans; dice ranks among all)
  isMe?: boolean;
}

// One round tab's condensed standings, shown on the Leaderboard once the round has
// started (its first match has kicked off). Top 2 and bottom 2 are humans only; Dice
// (the bot) is surfaced on its own line.
export interface RoundStandings {
  roundKey: string; // e.g. "Group Stage · Round 1", "Quarter-finals"
  finished: boolean; // every fixture in the round is FINISHED
  top2: RoundStanding[]; // up to 2 highest-scoring humans (points > 0)
  bottom2: RoundStanding[]; // up to 2 lowest-scoring humans (excludes anyone in top2)
  dice: RoundStanding | null; // the Dice bot's standing this round, or null if it didn't bet
}
