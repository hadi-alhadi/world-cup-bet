"use client";

import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import type { FixtureDTO, MyBetDTO } from "@/lib/types";
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

  const finished = fixture.status === "FINISHED";

  // Exact-score celebration (Tier 1): fire once when a finished bet earned 3 points.
  useEffect(() => {
    if (finished && myBet?.points === 3 && !firedConfetti.current) {
      firedConfetti.current = true;
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.7 },
        colors: ["#0b6e4f", "#10b981", "#fbbf24"],
      });
    }
  }, [finished, myBet?.points]);

  const fx = { ...fixture, myBet };

  return (
    <article className="card p-4">
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

      {/* Window countdown (only while still bettable / upcoming). */}
      {!finished && fixture.window.canBet && (
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
