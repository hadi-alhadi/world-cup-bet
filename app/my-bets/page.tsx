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

function StatusPill({ status }: { status: FixtureStatus }) {
  const map: Record<FixtureStatus, string> = {
    SCHEDULED: "bg-blue-50 text-blue-600",
    LIVE: "bg-red-50 text-red-600",
    FINISHED: "bg-slate-100 text-slate-500",
    POSTPONED: "bg-amber-50 text-amber-600",
    CANCELLED: "bg-slate-100 text-slate-400",
  };
  return (
    <span className={"rounded-full px-2 py-0.5 text-[11px] font-semibold " + map[status]}>
      {status}
    </span>
  );
}

function PointsCell({ points, status }: { points: number | null; status: FixtureStatus }) {
  if (status !== "FINISHED")
    return <span className="text-xs text-slate-400">—</span>;
  if (points === null) return <span className="text-xs text-slate-400">Pending</span>;
  const exact = points === 3;
  return (
    <span
      className={
        "rounded-full px-2.5 py-1 text-xs font-bold " +
        (points > 0
          ? exact
            ? "bg-amber-100 text-amber-700"
            : "bg-brand/10 text-brand"
          : "bg-slate-100 text-slate-400")
      }
    >
      {exact ? "🎯 " : ""}
      {points} pt{points === 1 ? "" : "s"}
    </span>
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
        <ul className="space-y-3">
          {data!.map((b) => (
            <li key={b.id} className="card p-4" data-testid={`mybet-${b.fixtureId}`}>
              <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                <span>{b.fixture.round ?? "Fixture"}</span>
                <span>{fmtShort(b.fixture.kickoffAt)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-1 items-center gap-2">
                  <TeamLogo team={b.fixture.homeTeam} size={24} />
                  <span className="truncate text-sm font-semibold">
                    {b.fixture.homeTeam.name}
                  </span>
                </div>
                <div className="text-center text-sm font-bold tabular-nums">
                  {b.fixture.status === "FINISHED" &&
                  b.fixture.homeScore !== null &&
                  b.fixture.awayScore !== null
                    ? `${b.fixture.homeScore}–${b.fixture.awayScore}`
                    : "vs"}
                </div>
                <div className="flex flex-1 items-center justify-end gap-2">
                  <span className="truncate text-right text-sm font-semibold">
                    {b.fixture.awayTeam.name}
                  </span>
                  <TeamLogo team={b.fixture.awayTeam} size={24} />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-sm">
                <span className="text-slate-500">
                  My pick:{" "}
                  <span className="font-semibold text-slate-700">
                    {OUTCOME_LABEL[b.outcome]} · {b.predHome}–{b.predAway}
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  <StatusPill status={b.fixture.status} />
                  <PointsCell points={b.points} status={b.fixture.status} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
