"use client";

import { useEffect, useState } from "react";
import { Countdown } from "@/components/Countdown";

interface NextRound {
  roundKey: string;
  opensAt: string;
  firstKickoff: string;
}

// Shows a live countdown to when the next round's betting opens (sits above the
// missing-bets banner on the games page). Hides when no round is pending.
export function NextRoundBanner() {
  const [next, setNext] = useState<NextRound | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/rounds/next")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setNext(d?.next ?? null))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!next) return null;

  return (
    <div
      data-testid="next-round-banner"
      className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-2xl border border-brand/20 bg-brand/5 px-4 py-3 text-sm font-medium text-brand"
    >
      <span aria-hidden>🔓</span>
      <span>
        Next round — <span className="font-bold">{next.roundKey}</span> — bets open in
      </span>
      <Countdown to={next.opensAt} className="font-bold tabular-nums" passedLabel="now — refresh to bet!" />
    </div>
  );
}
