"use client";

import type { FixtureStatus, Outcome } from "@/lib/types";
import { TeamLogo } from "@/components/TeamBadge";
import { Spinner, EmptyState, ErrorState, useApi } from "@/components/state";
import { fmtShort } from "@/components/format";

interface MyBetRow {
  id: string;
  fixtureId: number;
  outcome: Outcome;
  predHome: number;
  predAway: number;
  points: number | null;
  updatedAt: string;
  fixture: {
    id: number;
    kickoffAt: string;
    round: string | null;
    status: FixtureStatus;
    homeScore: number | null;
    awayScore: number | null;
    homeTeam: { id: number; name: string; logoUrl: string | null };
    awayTeam: { id: number; name: string; logoUrl: string | null };
  };
}

const OUTCOME_LABEL: Record<Outcome, string> = {
  HOME: "1",
  DRAW: "X",
  AWAY: "2",
};

// The single result-state a card is rendered in, derived from status + points.
type BetState = "exact" | "win" | "loss" | "pending" | "live" | "locked" | "muted";

interface StateStyle {
  /** Left accent stripe color. */
  stripe: string;
  /** Soft background wash + ring on the whole card. */
  card: string;
  /** Result badge classes. */
  badge: string;
  /** Result badge text. */
  label: string;
}

const STATE_STYLE: Record<BetState, StateStyle> = {
  exact: {
    stripe: "bg-amber-400",
    card: "bg-amber-50/60 ring-1 ring-amber-300 shadow-[0_0_0_1px_rgba(251,191,36,0.35),0_8px_24px_-8px_rgba(251,191,36,0.45)]",
    badge: "bg-amber-100 text-amber-700",
    label: "🎯 EXACT · +3",
  },
  win: {
    stripe: "bg-brand",
    card: "bg-brand/5 ring-1 ring-brand/30",
    badge: "bg-brand/10 text-brand",
    label: "✓ WIN · +1",
  },
  loss: {
    stripe: "bg-red-300",
    card: "bg-white opacity-90",
    badge: "bg-slate-100 text-slate-400",
    label: "MISS · 0",
  },
  pending: {
    stripe: "bg-slate-300",
    card: "bg-white",
    badge: "bg-slate-100 text-slate-500",
    label: "PENDING",
  },
  live: {
    stripe: "bg-red-500",
    card: "bg-red-50/70 ring-1 ring-red-300",
    badge: "bg-red-600 text-white",
    label: "LIVE",
  },
  locked: {
    stripe: "bg-brand-light",
    card: "bg-white",
    badge: "bg-blue-50 text-blue-600",
    label: "🔒 LOCKED IN",
  },
  muted: {
    stripe: "bg-slate-200",
    card: "bg-white opacity-80",
    badge: "bg-slate-100 text-slate-400",
    label: "",
  },
};

function betState(status: FixtureStatus, points: number | null): BetState {
  if (status === "LIVE") return "live";
  if (status === "SCHEDULED") return "locked";
  if (status === "POSTPONED" || status === "CANCELLED") return "muted";
  // FINISHED:
  if (points === null) return "pending";
  if (points === 3) return "exact";
  if (points > 0) return "win";
  return "loss";
}

function ResultBadge({ state, status }: { state: BetState; status: FixtureStatus }) {
  const s = STATE_STYLE[state];
  const text = state === "muted" && !s.label ? status : s.label;
  if (state === "live") {
    return (
      <span
        className={
          "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide " +
          s.badge +
          " animate-urgent-pulse motion-reduce:animate-none"
        }
      >
        <span className="relative flex h-2 w-2" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75 motion-reduce:hidden" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
        {text}
      </span>
    );
  }
  return (
    <span
      className={
        "whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide " +
        s.badge
      }
    >
      {text}
    </span>
  );
}

// Bigger, rounded + bordered flag for the mobile match layout (mirrors FixtureCard's
// flipped-face flag): object-cover so it hugs the flag instead of a letterboxed square.
function MobileFlag({ team }: { team: { name: string; logoUrl: string | null } }) {
  if (team.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={team.logoUrl}
        alt=""
        className="h-11 w-16 rounded-lg border border-slate-200 object-cover shadow-sm"
      />
    );
  }
  return (
    <span className="grid h-11 w-16 place-items-center rounded-lg border border-slate-200 bg-slate-100 text-sm font-bold text-slate-500">
      {team.name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function BetCard({ bet }: { bet: MyBetRow }) {
  const { fixture: fx } = bet;
  const state = betState(fx.status, bet.points);
  const style = STATE_STYLE[state];
  const showScore =
    fx.status === "FINISHED" && fx.homeScore !== null && fx.awayScore !== null;

  return (
    <li
      data-testid={`mybet-${bet.fixtureId}`}
      className={
        "card relative overflow-hidden p-4 pl-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-md " +
        style.card
      }
    >
      {/* Result-state accent stripe down the left edge. */}
      <span className={"absolute inset-y-0 left-0 w-1.5 " + style.stripe} aria-hidden />

      <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-slate-400">
        <span className="truncate">{fx.round ?? "Fixture"}</span>
        <span className="shrink-0">{fmtShort(fx.kickoffAt)}</span>
      </div>

      {/* Mobile: big flags side-by-side with the score centered underneath. */}
      <div className="sm:hidden">
        <div className="flex items-center justify-center gap-8">
          <MobileFlag team={fx.homeTeam} />
          <MobileFlag team={fx.awayTeam} />
        </div>
        <div className="mt-1.5 text-center text-lg font-extrabold tabular-nums">
          {showScore ? (
            <span>
              {fx.homeScore}
              <span className="px-1 text-slate-300">–</span>
              {fx.awayScore}
            </span>
          ) : (
            <span className="text-slate-300">vs</span>
          )}
        </div>
      </div>

      {/* sm+: flag + name inline, score in the middle. */}
      <div className="hidden items-center justify-between gap-2 sm:flex">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <TeamLogo team={fx.homeTeam} size={22} />
          <span className="truncate text-sm font-semibold">{fx.homeTeam.name}</span>
        </div>
        <div className="shrink-0 text-center text-sm font-extrabold tabular-nums">
          {showScore ? (
            <span>
              {fx.homeScore}
              <span className="text-slate-300">–</span>
              {fx.awayScore}
            </span>
          ) : (
            <span className="text-slate-300">vs</span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <span className="truncate text-right text-sm font-semibold">{fx.awayTeam.name}</span>
          <TeamLogo team={fx.awayTeam} size={22} />
        </div>
      </div>

      <div className="mt-3 flex flex-col items-center gap-2 border-t border-slate-200/70 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-ink text-[11px] font-bold text-white">
            {OUTCOME_LABEL[bet.outcome]}
          </span>
          <span className="whitespace-nowrap font-semibold tabular-nums text-slate-700">
            {bet.predHome}–{bet.predAway}
          </span>
        </span>
        <ResultBadge state={state} status={fx.status} />
      </div>
    </li>
  );
}

export default function MyBetsPage() {
  const { data, loading, error, reload } = useApi<MyBetRow[]>("/api/bets/me");

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">My Bets</h1>

      {loading && <Spinner label="Loading your bets…" />}
      {error && !loading && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (data?.length ?? 0) === 0 && (
        <EmptyState
          title="You haven't placed any bets yet"
          hint="Head to Games to make your first prediction."
        />
      )}

      {!loading && !error && (data?.length ?? 0) > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {data!.map((b) => (
            <BetCard key={b.id} bet={b} />
          ))}
        </ul>
      )}
    </div>
  );
}
