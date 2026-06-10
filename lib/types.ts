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
  status: FixtureStatus;
  homeScore: number | null;
  awayScore: number | null;
  window: WindowState;
  myBet: MyBetDTO | null;
  // Set when a knockout was decided after 90' (ET/penalties) and the admin still needs to
  // enter the 90-minute score (§14.4). resultDuration is the feed's match duration.
  needsManualResult: boolean;
  resultDuration: string | null;
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
  isMe?: boolean;
}
