"use client";

import { useMemo, useState } from "react";
import type { FixtureDTO } from "@/lib/types";
import { FixtureCard } from "@/components/FixtureCard";
import { NextRoundBanner } from "@/components/NextRoundBanner";
import { Spinner, EmptyState, ErrorState, useApi } from "@/components/state";
import { fmtDayHeading, dayKey } from "@/components/format";

type Filter = "upcoming" | "finished" | "all";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "finished", label: "Finished" },
  { key: "all", label: "All" },
];

export default function GamesPage() {
  const [filter, setFilter] = useState<Filter>("upcoming");
  const { data, loading, error, reload } = useApi<FixtureDTO[]>(
    `/api/fixtures?filter=${filter}`,
  );

  // Deadline FOMO: open fixtures I can still bet on but haven't.
  const missing = useMemo(
    () => (data ?? []).filter((f) => f.window.canBet && !f.myBet),
    [data],
  );

  // Keep the default "Upcoming" view clean & short: hide games you can't bet on right now
  // (live, closed, not-yet-open, postponed). "All" still shows everything; "Finished" the
  // results. Bettable games (window open) always show.
  const visible = useMemo(() => {
    const all = data ?? [];
    return filter === "upcoming" ? all.filter((f) => f.window.canBet) : all;
  }, [data, filter]);

  // Group fixtures by local calendar day, preserving server (kickoff asc) order.
  const groups = useMemo(() => {
    const map = new Map<string, FixtureDTO[]>();
    for (const f of visible) {
      const k = dayKey(f.kickoffAt);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(f);
    }
    return [...map.values()];
  }, [visible]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Games</h1>
        <div
          role="tablist"
          aria-label="Fixture filter"
          className="inline-flex rounded-xl border border-slate-200 bg-white p-1"
        >
          {FILTERS.map((f) => (
            <button
              key={f.key}
              role="tab"
              aria-selected={filter === f.key}
              data-testid={`filter-${f.key}`}
              onClick={() => setFilter(f.key)}
              className={
                "rounded-lg px-3 py-1.5 text-sm font-medium transition " +
                (filter === f.key
                  ? "bg-brand text-white"
                  : "text-slate-500 hover:bg-slate-100")
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <NextRoundBanner />

      {missing.length > 0 && (
        <div
          data-testid="fomo-banner"
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800"
        >
          ⏳ {missing.length} {missing.length === 1 ? "bet" : "bets"} missing — windows
          closing soon. Don&apos;t miss out!
        </div>
      )}

      {loading && <Spinner label="Loading fixtures…" />}
      {error && !loading && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && visible.length === 0 && (
        <EmptyState
          title={filter === "upcoming" ? "No matches open for betting" : "No fixtures here yet"}
          hint={
            filter === "finished"
              ? "No matches have finished yet."
              : filter === "upcoming"
                ? "Nothing's open right now — check the All tab for the full schedule."
                : "Check back once fixtures are synced."
          }
        />
      )}

      {!loading &&
        !error &&
        groups.map((group) => (
          <section key={dayKey(group[0].kickoffAt)} className="space-y-3">
            <h2 className="px-1 text-sm font-semibold text-slate-500">
              {fmtDayHeading(group[0].kickoffAt)}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {group.map((f) => (
                <FixtureCard key={f.id} fixture={f} />
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}
