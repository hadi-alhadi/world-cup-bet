"use client";

import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import type { CommunityPicks, FixtureDTO, MyBetDTO } from "@/lib/types";
import { TeamLogo } from "@/components/TeamBadge";
import { BetForm } from "@/components/BetForm";
import { Countdown } from "@/components/Countdown";
import { fmtKickoff } from "@/components/format";

const OUTCOME_LABEL: Record<string, string> = {
  HOME: "1",
  DRAW: "X",
  AWAY: "2",
};

export function FixtureCard({ fixture }: { fixture: FixtureDTO }) {
  // Local copy of the user's bet so saves reflect immediately without a full refetch.
  const [myBet, setMyBet] = useState<MyBetDTO | null>(fixture.myBet);
  const firedConfetti = useRef(false);
  const [now, setNow] = useState(() => Date.now());

  const finished = fixture.status === "FINISHED";

  // Tick once a second so the "closing soon" alert + timer stay live.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Urgent alert: window still open, no bet placed, and less than 5h to close.
  const FIVE_HOURS = 5 * 60 * 60 * 1000;
  const closesInMs = new Date(fixture.window.closesAt).getTime() - now;
  const closingSoon =
    !finished && fixture.window.canBet && !myBet && closesInMs > 0 && closesInMs <= FIVE_HOURS;

  // Exact-score celebration (Tier 1): fire once when a finished bet earned 3 points.
  useEffect(() => {
    if (finished && myBet?.points === 3 && !firedConfetti.current) {
      firedConfetti.current = true;
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.7 },
        colors: ["#7688a2", "#a6b2c3", "#fbbf24"],
      });
    }
  }, [finished, myBet?.points]);

  const fx = { ...fixture, myBet };

  return (
    <article className="card p-4">
      {closingSoon && (
        <div
          data-testid={`closing-alert-${fixture.id}`}
          role="alert"
          className="mb-3 flex items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-white shadow-md animate-urgent-pulse motion-reduce:animate-none"
        >
          {/* Pinging live dot for urgency (animation only — no harsh blink). */}
          <span className="relative flex h-2.5 w-2.5" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75 motion-reduce:hidden" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
          </span>
          <span>
            Closes in <Countdown to={fixture.window.closesAt} /> — bet now!
          </span>
        </div>
      )}
      <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
        <span>{fixture.round ?? "Fixture"}</span>
        <span>{fmtKickoff(fixture.kickoffAt)}</span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-1 items-center gap-2">
          <TeamLogo team={fixture.homeTeam} />
          <span className="truncate text-sm font-semibold">{fixture.homeTeam.name}</span>
        </div>

        <div className="px-2 text-center">
          {finished &&
          fixture.homeScore !== null &&
          fixture.awayScore !== null ? (
            <span className="text-lg font-extrabold tabular-nums">
              {fixture.homeScore}–{fixture.awayScore}
            </span>
          ) : (
            <span className="text-sm font-bold text-slate-300">vs</span>
          )}
        </div>

        <div className="flex flex-1 items-center justify-end gap-2">
          <span className="truncate text-right text-sm font-semibold">
            {fixture.awayTeam.name}
          </span>
          <TeamLogo team={fixture.awayTeam} />
        </div>
      </div>

      {fixture.communityPicks && fixture.communityPicks.total > 0 && (
        <CommunityPicksBar
          fixtureId={fixture.id}
          homeName={fixture.homeTeam.name}
          awayName={fixture.awayTeam.name}
          picks={fixture.communityPicks}
        />
      )}

      {/* Window countdown (only while still bettable / upcoming; the red alert above
          replaces it once a match is closing soon with no bet). */}
      {!finished && fixture.window.canBet && !closingSoon && (
        <p className="mt-2 text-center text-xs text-slate-500">
          <Countdown
            to={fixture.window.closesAt}
            prefix="Betting closes in "
            passedLabel="Betting closed"
          />
        </p>
      )}

      {finished ? (
        <div className="mt-3 border-t border-slate-100 pt-3 text-sm">
          {myBet ? (
            <div className="flex items-center justify-between">
              <span className="text-slate-500">
                Your pick:{" "}
                <span className="font-semibold text-slate-700">
                  {OUTCOME_LABEL[myBet.outcome]} · {myBet.predHome}–{myBet.predAway}
                </span>
              </span>
              <PointsBadge points={myBet.points} />
            </div>
          ) : (
            <p className="text-center text-xs text-slate-400">No bet placed</p>
          )}
        </div>
      ) : fixture.status === "SCHEDULED" ? (
        <BetForm fixture={fx} onSaved={setMyBet} />
      ) : (
        <p className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-center text-xs font-medium text-slate-500">
          {fixture.status === "LIVE" ? "🔴 Live — betting locked" : fixture.status}
        </p>
      )}
    </article>
  );
}

function CommunityPicksBar({
  fixtureId,
  homeName,
  awayName,
  picks,
}: {
  fixtureId: number;
  homeName: string;
  awayName: string;
  picks: CommunityPicks;
}) {
  // Round to whole percents; total is guaranteed > 0 by the caller.
  const pct = (n: number) => Math.round((n / picks.total) * 100);
  const homePct = pct(picks.home);
  const drawPct = pct(picks.draw);
  const awayPct = pct(picks.away);

  const segments = [
    { key: "home", label: "1", pct: homePct, cls: "bg-brand" },
    { key: "draw", label: "X", pct: drawPct, cls: "bg-slate-400" },
    { key: "away", label: "2", pct: awayPct, cls: "bg-amber-500" },
  ];

  return (
    <div data-testid={`community-picks-${fixtureId}`} className="mt-3">
      <p className="mb-1 text-[11px] font-medium text-slate-400">
        Community picks ({picks.total})
      </p>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">
        {segments.map((s) =>
          s.pct > 0 ? (
            <span
              key={s.key}
              className={s.cls}
              style={{ width: `${s.pct}%` }}
              aria-hidden
            />
          ) : null,
        )}
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        <span className="font-semibold text-slate-700">{homeName}</span> {homePct}
        % <span className="text-slate-300">·</span> Draw {drawPct}%{" "}
        <span className="text-slate-300">·</span>{" "}
        <span className="font-semibold text-slate-700">{awayName}</span> {awayPct}%
      </p>
    </div>
  );
}

function PointsBadge({ points }: { points: number | null }) {
  if (points === null)
    return <span className="text-xs text-slate-400">Pending</span>;
  const exact = points === 3;
  return (
    <span
      data-testid="earned-points"
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
