"use client";

import { useMemo, useState } from "react";
import type { FixtureDTO, MyBetDTO, Outcome } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { fmtShort } from "@/components/format";

type Props = {
  fixture: FixtureDTO;
  onSaved: (bet: MyBetDTO) => void;
};

// Derive the outcome implied by a predicted score, for the soft-contradiction warning.
function impliedOutcome(home: number, away: number): Outcome {
  if (home > away) return "HOME";
  if (home < away) return "AWAY";
  return "DRAW";
}

function Stepper({
  label,
  testid,
  value,
  onChange,
  disabled,
}: {
  label: string;
  testid: string;
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          data-testid={`${testid}-dec`}
          disabled={disabled || value <= 0}
          onClick={() => onChange(Math.max(0, value - 1))}
          className="btn-ghost h-8 w-8 p-0 text-lg leading-none"
        >
          −
        </button>
        <span
          data-testid={testid}
          className="w-8 text-center text-lg font-bold tabular-nums"
        >
          {value}
        </span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          data-testid={`${testid}-inc`}
          disabled={disabled || value >= 20}
          onClick={() => onChange(Math.min(20, value + 1))}
          className="btn-ghost h-8 w-8 p-0 text-lg leading-none"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function BetForm({ fixture, onSaved }: Props) {
  const { toast } = useToast();
  const existing = fixture.myBet;

  const [outcome, setOutcome] = useState<Outcome | null>(existing?.outcome ?? null);
  const [predHome, setPredHome] = useState<number>(existing?.predHome ?? 0);
  const [predAway, setPredAway] = useState<number>(existing?.predAway ?? 0);
  const [saving, setSaving] = useState(false);

  const canBet = fixture.window.canBet;

  // Disabled-with-reason copy (cosmetic; server is authoritative).
  const lockReason = useMemo(() => {
    if (canBet) return null;
    switch (fixture.window.reason) {
      case "NOT_OPEN_YET":
        return `Opens ${fmtShort(fixture.window.opensAt)}`;
      case "CLOSED":
        return "Closed — betting locked";
      case "NOT_SCHEDULED":
        return "Not open for betting";
      default:
        return "Betting closed";
    }
  }, [canBet, fixture.window]);

  const contradiction =
    outcome !== null && outcome !== impliedOutcome(predHome, predAway);

  async function save() {
    if (!outcome) {
      toast("Pick a result first (Win / Draw / Win)", "error");
      return;
    }
    if (contradiction) {
      toast("Your result and predicted score don't match — adjust one to save.", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/bets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fixtureId: fixture.id,
          outcome,
          predHome,
          predAway,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const code = body?.error?.code;
        toast(
          code === "BET_WINDOW_CLOSED"
            ? "Betting window has closed for this match."
            : (body?.error?.message ?? "Could not save bet."),
          "error",
        );
        return;
      }
      const saved = (await res.json()) as {
        outcome: Outcome;
        predHome: number;
        predAway: number;
        points: number | null;
        updatedAt: string;
      };
      onSaved({
        outcome: saved.outcome,
        predHome: saved.predHome,
        predAway: saved.predAway,
        points: saved.points,
        updatedAt: saved.updatedAt,
      });
      toast(existing ? "Bet updated" : "Bet saved", "success");
    } catch {
      toast("Network error — please retry.", "error");
    } finally {
      setSaving(false);
    }
  }

  const outcomeBtn = (key: Outcome, label: string, sub?: string) => {
    const active = outcome === key;
    return (
      <button
        type="button"
        data-testid={`outcome-${key.toLowerCase()}`}
        aria-pressed={active}
        disabled={!canBet}
        onClick={() => setOutcome(key)}
        className={
          "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-2.5 transition " +
          (active
            ? "border-brand bg-brand text-white"
            : "border-slate-200 bg-white text-slate-700 hover:border-brand/40")
        }
      >
        <span className="text-center text-[13px] font-bold leading-tight">{label}</span>
        {sub && (
          <span
            className={
              "text-[10px] font-semibold uppercase tracking-wide " +
              (active ? "text-white/85" : "text-slate-400")
            }
          >
            {sub}
          </span>
        )}
      </button>
    );
  };

  return (
    <div data-testid="bet-form" className="mt-3 space-y-3">
      {!canBet && lockReason && (
        <div
          data-testid="bet-locked"
          className="rounded-xl bg-slate-100 px-3 py-2 text-center text-xs font-medium text-slate-500"
        >
          🔒 {lockReason}
        </div>
      )}

      <div className="flex gap-2">
        {outcomeBtn("HOME", fixture.homeTeam.name, "Win")}
        {outcomeBtn("DRAW", "Draw")}
        {outcomeBtn("AWAY", fixture.awayTeam.name, "Win")}
      </div>

      <p className="text-center text-[11px] font-medium uppercase tracking-wide text-slate-400">
        Predicted score — goals
      </p>
      <div className="flex items-center justify-center gap-4">
        <Stepper
          label={fixture.homeTeam.name}
          testid="pred-home"
          value={predHome}
          onChange={setPredHome}
          disabled={!canBet}
        />
        <span className="pt-4 text-lg font-bold text-slate-300">:</span>
        <Stepper
          label={fixture.awayTeam.name}
          testid="pred-away"
          value={predAway}
          onChange={setPredAway}
          disabled={!canBet}
        />
      </div>

      {contradiction && canBet && (
        <p
          data-testid="contradiction-warning"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-xs font-medium text-red-700"
        >
          ⚠️ Your score {predHome}–{predAway} doesn&apos;t match your selected result. Adjust
          your pick or the score to save.
        </p>
      )}

      <button
        type="button"
        data-testid="save-bet"
        disabled={!canBet || saving || contradiction}
        onClick={save}
        className="btn-brand w-full"
      >
        {saving ? "Saving…" : existing ? "Update bet" : "Save bet"}
      </button>
    </div>
  );
}
