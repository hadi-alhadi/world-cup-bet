"use client";

import { useState } from "react";
import type { LeaderboardRow, RoundStandings, RoundStanding, TeamDTO } from "@/lib/types";
import { Spinner, EmptyState, ErrorState, useApi } from "@/components/state";
import { BADGE_BY_KEY } from "@/lib/badge-catalog";

// Avatar with the user's champion pick as a small badge on the bottom-right corner.
function Avatar({
  name,
  image,
  pickedTeam,
}: {
  name: string | null;
  image: string | null;
  pickedTeam?: TeamDTO | null;
}) {
  return (
    <span className="relative inline-block shrink-0">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="h-9 w-9 rounded-full border border-slate-200 object-cover" />
      ) : (
        <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-200 text-sm font-bold text-slate-600">
          {(name ?? "?").slice(0, 1).toUpperCase()}
        </span>
      )}
      {pickedTeam &&
        (pickedTeam.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pickedTeam.logoUrl}
            alt=""
            title={`Champion pick: ${pickedTeam.name}`}
            className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border border-white bg-white object-cover shadow-sm"
          />
        ) : (
          <span
            title={`Champion pick: ${pickedTeam.name}`}
            className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full border border-white bg-slate-300 text-[8px] font-bold text-slate-700 shadow-sm"
          >
            {pickedTeam.name.slice(0, 1)}
          </span>
        ))}
    </span>
  );
}

function rankStyle(rank: number): string {
  if (rank === 1) return "bg-amber-100 text-amber-700";
  if (rank === 2) return "bg-slate-200 text-slate-600";
  if (rank === 3) return "bg-orange-100 text-orange-700";
  return "bg-slate-100 text-slate-500";
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function OverallTable({ rows }: { rows: LeaderboardRow[] }) {
  return (
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
        {rows.map((row) => (
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
              <Avatar name={row.name} image={row.image} pickedTeam={row.pickedTeam} />
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
                        <span key={key} title={badge.name} aria-label={badge.name}>
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
  );
}

function RoundRow({ s }: { s: RoundStanding }) {
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
        {s.isMe && <span className="ml-1 text-xs font-medium text-brand">(you)</span>}
      </span>
      <span className="text-sm font-bold tabular-nums text-brand">{s.points}</span>
    </li>
  );
}

function Section({
  title,
  emoji,
  rows,
  empty,
}: {
  title: string;
  emoji: string;
  rows: RoundStanding[];
  empty: string;
}) {
  return (
    <div>
      <p className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        <span aria-hidden>{emoji}</span> {title}
      </p>
      {rows.length > 0 ? (
        <ul>
          {rows.map((s) => (
            <RoundRow key={s.userId} s={s} />
          ))}
        </ul>
      ) : (
        <p className="px-4 py-2 text-sm text-slate-400">{empty}</p>
      )}
    </div>
  );
}

function RoundPanel({ round }: { round: RoundStandings }) {
  const s = slug(round.roundKey);
  const hasResults =
    round.top2.length > 0 || round.bottom2.length > 0 || round.dice !== null;

  return (
    <div data-testid={`lb-round-${s}`} className="card overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <h2 className="text-base font-bold">{round.roundKey}</h2>
        {round.finished ? (
          <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-semibold text-brand">
            Finished
          </span>
        ) : (
          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
            In progress
          </span>
        )}
      </div>

      {!hasResults ? (
        <p className="px-4 py-6 text-center text-sm text-slate-400">
          No results yet — matches in progress.
        </p>
      ) : (
        <>
          <Section title="Top 2" emoji="🏆" rows={round.top2} empty="No scores yet." />
          <Section
            title="Bottom 2"
            emoji="🐌"
            rows={round.bottom2}
            empty="Not enough players yet."
          />
          <div className="border-t border-slate-100">
            <p className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <span aria-hidden>🎲</span> Dice
            </p>
            {round.dice ? (
              <RoundRow s={round.dice} />
            ) : (
              <p className="px-4 py-2 text-sm text-slate-400">Dice sat this round out.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function LeaderboardPage() {
  const overall = useApi<LeaderboardRow[]>("/api/leaderboard");
  const rounds = useApi<RoundStandings[]>("/api/leaderboard/rounds");
  const [tab, setTab] = useState<string>("overall"); // "overall" | roundKey

  const roundList = rounds.data ?? [];
  const active = roundList.find((r) => r.roundKey === tab);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Leaderboard</h1>

      {/* Tab bar: Overall + one per started round */}
      <div
        role="tablist"
        aria-label="Leaderboard view"
        className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1"
      >
        <button
          role="tab"
          aria-selected={tab === "overall"}
          data-testid="lb-tab-overall"
          onClick={() => setTab("overall")}
          className={
            "rounded-lg px-3 py-1.5 text-sm font-medium transition " +
            (tab === "overall" ? "bg-brand text-white" : "text-slate-500 hover:bg-slate-100")
          }
        >
          Overall
        </button>
        {roundList.map((r) => (
          <button
            key={r.roundKey}
            role="tab"
            aria-selected={tab === r.roundKey}
            data-testid={`lb-tab-${slug(r.roundKey)}`}
            onClick={() => setTab(r.roundKey)}
            className={
              "rounded-lg px-3 py-1.5 text-sm font-medium transition " +
              (tab === r.roundKey ? "bg-brand text-white" : "text-slate-500 hover:bg-slate-100")
            }
          >
            {r.roundKey}
          </button>
        ))}
      </div>

      {tab === "overall" ? (
        <>
          {overall.loading && <Spinner label="Loading leaderboard…" />}
          {overall.error && !overall.loading && (
            <ErrorState message={overall.error} onRetry={overall.reload} />
          )}
          {!overall.loading && !overall.error && (overall.data?.length ?? 0) === 0 && (
            <EmptyState title="No players yet" hint="Be the first to place a bet!" />
          )}
          {!overall.loading && !overall.error && (overall.data?.length ?? 0) > 0 && (
            <OverallTable rows={overall.data!} />
          )}
        </>
      ) : active ? (
        <RoundPanel round={active} />
      ) : (
        <EmptyState
          title="Round not available"
          hint="This round hasn't started yet — check back after kickoff."
        />
      )}
    </div>
  );
}
