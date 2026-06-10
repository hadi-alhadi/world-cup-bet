"use client";

import type { BadgeWallEntry } from "@/lib/badge-catalog";
import { Spinner, EmptyState, ErrorState, useApi } from "@/components/state";

function fmtAwarded(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function BadgeTile({ badge }: { badge: BadgeWallEntry }) {
  return (
    <div
      data-testid={
        badge.earned ? `badge-earned-${badge.key}` : `badge-${badge.key}`
      }
      className={
        "card flex flex-col items-center gap-2 p-4 text-center transition " +
        (badge.earned
          ? "border-brand/30 ring-1 ring-brand/10"
          : "opacity-40 grayscale")
      }
    >
      <span className="text-4xl leading-none" aria-hidden>
        {badge.emoji}
      </span>
      <p className="text-sm font-bold text-slate-800">{badge.name}</p>
      <p className="text-xs text-slate-500">{badge.description}</p>
      {badge.earned ? (
        <span className="mt-1 rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-semibold text-brand">
          Earned{badge.awardedAt ? ` · ${fmtAwarded(badge.awardedAt)}` : ""}
        </span>
      ) : (
        <span className="mt-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-400">
          🔒 Locked
        </span>
      )}
    </div>
  );
}

export default function BadgesPage() {
  const { data, loading, error, reload } =
    useApi<BadgeWallEntry[]>("/api/badges/me");

  const earnedCount = (data ?? []).filter((b) => b.earned).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Badges</h1>
        {!loading && !error && (data?.length ?? 0) > 0 && (
          <span
            data-testid="badge-progress"
            className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600"
          >
            {earnedCount} / {data!.length} earned
          </span>
        )}
      </div>

      {loading && <Spinner label="Loading badges…" />}
      {error && !loading && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (data?.length ?? 0) === 0 && (
        <EmptyState
          title="No badges yet"
          hint="Place bets and pick the champion to start earning badges."
        />
      )}

      {!loading && !error && (data?.length ?? 0) > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {data!.map((b) => (
            <BadgeTile key={b.key} badge={b} />
          ))}
        </div>
      )}
    </div>
  );
}
