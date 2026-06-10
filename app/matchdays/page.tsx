"use client";

import type { Matchday, MatchdayStanding } from "@/lib/types";
import { Spinner, EmptyState, ErrorState, useApi } from "@/components/state";

function slug(round: string): string {
  return round
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function Avatar({
  name,
  image,
  size = "md",
}: {
  name: string | null;
  image: string | null;
  size?: "md" | "lg";
}) {
  const cls = size === "lg" ? "h-12 w-12 text-base" : "h-8 w-8 text-xs";
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        className={`${cls} rounded-full border border-slate-200 object-cover`}
      />
    );
  }
  return (
    <span
      className={`${cls} grid place-items-center rounded-full bg-slate-200 font-bold text-slate-600`}
    >
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

function StandingRow({ s }: { s: MatchdayStanding }) {
  return (
    <li
      className={
        "flex items-center gap-2 border-b border-slate-50 px-4 py-2 last:border-0 " +
        (s.isMe ? "bg-brand/5" : "")
      }
    >
      <span
        className={
          "grid h-6 w-6 place-items-center rounded-full text-xs font-bold " +
          rankStyle(s.rank)
        }
      >
        {s.rank}
      </span>
      <Avatar name={s.name} image={s.image} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {s.name ?? "Anonymous"}
        {s.isMe && (
          <span className="ml-1 text-xs font-medium text-brand">(you)</span>
        )}
      </span>
      <span className="text-sm font-bold tabular-nums text-brand">
        {s.points}
      </span>
    </li>
  );
}

function MatchdayCard({ md }: { md: Matchday }) {
  const s = slug(md.round);
  return (
    <article data-testid={`matchday-${s}`} className="card overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <h2 className="text-base font-bold">{md.round}</h2>
        {md.finished ? (
          <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-semibold text-brand">
            Finished
          </span>
        ) : (
          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
            In progress
          </span>
        )}
      </div>

      {md.winner && (
        <div
          data-testid={`matchday-winner-${s}`}
          className="flex items-center gap-3 border-b border-slate-100 bg-amber-50/60 px-4 py-3"
        >
          <span className="text-2xl" aria-hidden>
            🏆
          </span>
          <Avatar name={md.winner.name} image={md.winner.image} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
              {md.finished ? "Winner" : "Leading"}
            </p>
            <p className="truncate text-sm font-bold text-slate-800">
              {md.winner.name ?? "Anonymous"}
              {md.winner.isMe && (
                <span className="ml-1 text-xs font-medium text-brand">
                  (you)
                </span>
              )}
            </p>
          </div>
          <span className="text-lg font-extrabold tabular-nums text-amber-700">
            {md.winner.points} pt{md.winner.points === 1 ? "" : "s"}
          </span>
        </div>
      )}

      {md.standings.length > 0 ? (
        <ul>
          {md.standings.map((st) => (
            <StandingRow key={st.userId} s={st} />
          ))}
        </ul>
      ) : (
        <p className="px-4 py-6 text-center text-sm text-slate-400">
          No standings yet for this round.
        </p>
      )}
    </article>
  );
}

export default function MatchdaysPage() {
  const { data, loading, error, reload } =
    useApi<Matchday[]>("/api/matchdays");

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Matchdays</h1>

      {loading && <Spinner label="Loading matchdays…" />}
      {error && !loading && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (data?.length ?? 0) === 0 && (
        <EmptyState
          title="No matchdays yet"
          hint="Round results will appear here once matches are played."
        />
      )}

      {!loading && !error && (data?.length ?? 0) > 0 && (
        <div className="space-y-4">
          {data!.map((md) => (
            <MatchdayCard key={md.round} md={md} />
          ))}
        </div>
      )}
    </div>
  );
}
