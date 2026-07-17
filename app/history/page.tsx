"use client";

import type { FixtureStatus, Outcome } from "@/lib/types";
import { TeamLogo } from "@/components/TeamBadge";
import { Spinner, EmptyState, ErrorState, useApi } from "@/components/state";
import { fmtShort } from "@/components/format";

interface HistoryBet {
  id: string;
  outcome: Outcome;
  predHome: number;
  predAway: number;
  points: number | null;
  createdAt: string;
  updatedAt: string;
  createdAfterLock: boolean;
  user: { id: string; name: string | null; email: string; image: string | null };
}

interface HistoryFixture {
  id: number;
  kickoffAt: string;
  lockAt: string;
  round: string | null;
  status: FixtureStatus;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: { id: number; name: string; logoUrl: string | null };
  awayTeam: { id: number; name: string; logoUrl: string | null };
  bets: HistoryBet[];
}

const OUTCOME_LABEL: Record<Outcome, string> = {
  HOME: "1",
  DRAW: "X",
  AWAY: "2",
};

function Avatar({ user }: { user: HistoryBet["user"] }) {
  if (user.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.image}
        alt=""
        className="h-6 w-6 shrink-0 rounded-full border border-slate-200 object-cover"
      />
    );
  }
  return (
    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">
      {(user.name ?? user.email).slice(0, 1).toUpperCase()}
    </span>
  );
}

function BetRow({ bet }: { bet: HistoryBet }) {
  // A bet is "late" only when it was CREATED at/after the lock time.
  const late = bet.createdAfterLock;
  const wasEdited = bet.updatedAt !== bet.createdAt;

  return (
    <tr
      data-testid={`history-bet-${bet.id}`}
      className={
        "border-t border-slate-100 text-sm " +
        (late ? "bg-red-50/80 text-red-900" : "text-slate-700")
      }
    >
      <td className="px-3 py-2">
        <span className="flex items-center gap-2">
          <Avatar user={bet.user} />
          <span className="min-w-0">
            <span className="block truncate font-semibold">
              {bet.user.name ?? bet.user.email}
            </span>
            {bet.user.name && (
              <span className="block truncate text-[11px] text-slate-400">
                {bet.user.email}
              </span>
            )}
          </span>
        </span>
      </td>
      <td className="whitespace-nowrap px-3 py-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-ink text-[11px] font-bold text-white">
            {OUTCOME_LABEL[bet.outcome]}
          </span>
          <span className="font-semibold tabular-nums">
            {bet.predHome}–{bet.predAway}
          </span>
        </span>
      </td>
      <td
        className={
          "whitespace-nowrap px-3 py-2 tabular-nums " +
          (bet.createdAfterLock ? "font-bold text-red-600" : "")
        }
      >
        {fmtShort(bet.createdAt)}
      </td>
      <td className="whitespace-nowrap px-3 py-2 tabular-nums">
        {wasEdited ? fmtShort(bet.updatedAt) : <span className="text-slate-300">—</span>}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right">
        {late ? (
          <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-red-700">
            ⚠ After lock
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            On time
          </span>
        )}
      </td>
    </tr>
  );
}

function GameCard({ fx }: { fx: HistoryFixture }) {
  const showScore =
    fx.status === "FINISHED" && fx.homeScore !== null && fx.awayScore !== null;
  const lateCount = fx.bets.filter((b) => b.createdAfterLock).length;

  return (
    <section data-testid={`history-game-${fx.id}`} className="card overflow-hidden p-0">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
        <span className="flex min-w-0 items-center gap-2 font-semibold">
          <TeamLogo team={fx.homeTeam} size={20} />
          <span className="truncate">{fx.homeTeam.name}</span>
          <span className="shrink-0 text-sm font-extrabold tabular-nums text-slate-500">
            {showScore ? `${fx.homeScore}–${fx.awayScore}` : "vs"}
          </span>
          <span className="truncate">{fx.awayTeam.name}</span>
          <TeamLogo team={fx.awayTeam} size={20} />
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
          {fx.round && <span>{fx.round}</span>}
          <span>Kickoff {fmtShort(fx.kickoffAt)}</span>
          <span className="font-semibold text-slate-500">🔒 Lock {fmtShort(fx.lockAt)}</span>
          {lateCount > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 font-extrabold uppercase tracking-wide text-red-700">
              {lateCount} after lock
            </span>
          )}
        </span>
      </header>

      {fx.bets.length === 0 ? (
        <p className="px-4 py-4 text-sm text-slate-400">No bets on this game.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2 font-semibold">User</th>
                <th className="px-3 py-2 font-semibold">Bet</th>
                <th className="px-3 py-2 font-semibold">Placed</th>
                <th className="px-3 py-2 font-semibold">Updated</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {fx.bets.map((b) => (
                <BetRow key={b.id} bet={b} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function HistoryPage() {
  const { data, loading, error, reload } = useApi<HistoryFixture[]>("/api/history");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">History</h1>
        <p className="mt-1 text-sm text-slate-400">
          Every game with everyone&apos;s bets and when they were placed. Rows in red were
          created after the betting lock (2 hours before kickoff).
        </p>
      </div>

      {loading && <Spinner label="Loading history…" />}
      {error && !loading && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (data?.length ?? 0) === 0 && (
        <EmptyState title="No games yet" hint="Games will appear here once fixtures are imported." />
      )}

      {!loading && !error && (data?.length ?? 0) > 0 && (
        <div className="space-y-4">
          {data!.map((fx) => (
            <GameCard key={fx.id} fx={fx} />
          ))}
        </div>
      )}
    </div>
  );
}
