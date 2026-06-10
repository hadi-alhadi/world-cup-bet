"use client";

import type { LeaderboardRow } from "@/lib/types";
import { Spinner, EmptyState, ErrorState, useApi } from "@/components/state";
import { BADGE_BY_KEY } from "@/lib/badge-catalog";

function Avatar({ name, image }: { name: string | null; image: string | null }) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={image} alt="" className="h-9 w-9 rounded-full border border-slate-200 object-cover" />
    );
  }
  return (
    <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-200 text-sm font-bold text-slate-600">
      {(name ?? "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

function rankStyle(rank: number): string {
  if (rank === 1) return "bg-amber-100 text-amber-700";
  if (rank === 2) return "bg-slate-200 text-slate-600";
  if (rank === 3) return "bg-orange-100 text-orange-700";
  return "bg-slate-100 text-slate-500";
}

export default function LeaderboardPage() {
  const { data, loading, error, reload } = useApi<LeaderboardRow[]>("/api/leaderboard");

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Leaderboard</h1>

      {loading && <Spinner label="Loading leaderboard…" />}
      {error && !loading && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (data?.length ?? 0) === 0 && (
        <EmptyState title="No players yet" hint="Be the first to place a bet!" />
      )}

      {!loading && !error && (data?.length ?? 0) > 0 && (
        <div className="card overflow-hidden">
          {/* Column header (hidden on small screens) */}
          <div className="hidden grid-cols-[3rem_1fr_5rem_5rem_4rem] gap-2 border-b border-slate-100 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 sm:grid">
            <span>Rank</span>
            <span>Player</span>
            <span className="text-right">Match</span>
            <span className="text-right">Champ</span>
            <span className="text-right">Total</span>
          </div>

          <ul>
            {data!.map((row) => (
              <li
                key={row.userId}
                data-testid={`leaderboard-row-${row.userId}`}
                className={
                  "flex flex-wrap items-center gap-2 border-b border-slate-50 px-4 py-3 last:border-0 sm:grid sm:grid-cols-[3rem_1fr_5rem_5rem_4rem] " +
                  (row.isMe ? "bg-brand/5" : "")
                }
              >
                <span
                  className={
                    "grid h-7 w-7 place-items-center rounded-full text-xs font-bold " +
                    rankStyle(row.rank)
                  }
                >
                  {row.rank}
                </span>

                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Avatar name={row.name} image={row.image} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold">
                        {row.name ?? "Anonymous"}
                        {row.isMe && (
                          <span className="ml-1 text-xs font-medium text-brand">(you)</span>
                        )}
                      </span>
                      {row.streak > 0 && (
                        <span
                          title={`${row.streak} correct in a row`}
                          className="rounded-full bg-orange-50 px-1.5 py-0.5 text-[11px] font-bold text-orange-600"
                        >
                          🔥 {row.streak}
                        </span>
                      )}
                    </div>
                    {row.title && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                        {row.title}
                      </span>
                    )}
                    {row.badges.length > 0 && (
                      <span
                        data-testid={`leaderboard-badges-${row.userId}`}
                        className="flex items-center gap-0.5 text-sm leading-none"
                      >
                        {row.badges.map((key) => {
                          const badge = BADGE_BY_KEY[key];
                          if (!badge) return null;
                          return (
                            <span
                              key={key}
                              title={badge.name}
                              aria-label={badge.name}
                            >
                              {badge.emoji}
                            </span>
                          );
                        })}
                      </span>
                    )}
                  </div>
                </div>

                <span className="text-right text-sm tabular-nums text-slate-500">
                  <span className="sm:hidden">Match: </span>
                  {row.matchPoints}
                </span>
                <span className="text-right text-sm tabular-nums text-slate-500">
                  <span className="sm:hidden">Champ: </span>
                  {row.winnerPoints}
                </span>
                <span className="text-right text-base font-bold tabular-nums text-brand">
                  {row.total}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
