"use client";

import { useState } from "react";
import type { TeamDTO } from "@/lib/types";
import { TeamLogo } from "@/components/TeamBadge";
import { useToast } from "@/components/Toast";
import { Spinner, EmptyState, ErrorState, useApi } from "@/components/state";

interface MyPick {
  id: string;
  points: number | null;
  team: TeamDTO;
}

export default function PickWinnerPage() {
  const { toast } = useToast();
  const teamsApi = useApi<TeamDTO[]>("/api/winner-pick/teams");
  const meApi = useApi<MyPick | null>("/api/winner-pick/me");

  const [confirming, setConfirming] = useState<TeamDTO | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loading = teamsApi.loading || meApi.loading;
  const error = teamsApi.error || meApi.error;
  const pick = meApi.data;

  async function confirmPick() {
    if (!confirming) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/winner-pick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: confirming.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const code = body?.error?.code;
        if (code === "ALREADY_PICKED") {
          toast("You've already locked in a champion.", "error");
          await meApi.reload();
        } else if (code === "DEADLINE_PASSED") {
          toast("The champion pick deadline has passed.", "error");
        } else {
          toast(body?.error?.message ?? "Could not save your pick.", "error");
        }
        setConfirming(null);
        return;
      }
      toast("Champion locked in! 🏆", "success");
      setConfirming(null);
      await meApi.reload();
    } catch {
      toast("Network error — please retry.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Pick the Champion</h1>
        <p className="mt-1 text-sm text-slate-500">
          Choose the team you think will win the tournament. Worth 6 points — but you can
          pick only once, and it can&apos;t be changed.
        </p>
      </div>

      {loading && <Spinner label="Loading teams…" />}
      {error && !loading && (
        <ErrorState
          message={error}
          onRetry={() => {
            teamsApi.reload();
            meApi.reload();
          }}
        />
      )}

      {/* Locked view: pick already made. */}
      {!loading && !error && pick && (
        <div
          data-testid="pick-locked"
          className="card flex flex-col items-center gap-3 px-6 py-10 text-center"
        >
          <TeamLogo team={pick.team} size={72} />
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Your champion pick
            </p>
            <p className="text-xl font-bold">{pick.team.name}</p>
          </div>
          {pick.points !== null ? (
            <span
              className={
                "rounded-full px-3 py-1 text-sm font-bold " +
                (pick.points > 0
                  ? "bg-brand/10 text-brand"
                  : "bg-slate-100 text-slate-400")
              }
            >
              {pick.points > 0 ? `🏆 +${pick.points} points` : "0 points"}
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-500">
              🔒 Locked — awaiting tournament result
            </span>
          )}
        </div>
      )}

      {/* Grid: no pick yet. */}
      {!loading && !error && !pick && (teamsApi.data?.length ?? 0) === 0 && (
        <EmptyState title="No teams available yet" hint="Teams appear once fixtures are synced." />
      )}

      {!loading && !error && !pick && (teamsApi.data?.length ?? 0) > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {teamsApi.data!.map((team) => (
            <button
              key={team.id}
              type="button"
              data-testid={`winner-team-${team.id}`}
              onClick={() => setConfirming(team)}
              className="card flex flex-col items-center gap-2 p-4 transition hover:border-brand hover:shadow-md"
            >
              <TeamLogo team={team} size={48} />
              <span className="text-center text-sm font-semibold">{team.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Confirm dialog */}
      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm champion pick"
        >
          <div className="card w-full max-w-sm p-6 text-center">
            <TeamLogo team={confirming} size={64} />
            <h2 className="mt-3 text-lg font-bold">Pick {confirming.name}?</h2>
            <p className="mt-1 text-sm text-red-600">
              This is permanent — your champion pick cannot be changed.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirming(null)}
                disabled={submitting}
                className="btn-ghost flex-1"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="confirm-pick"
                onClick={confirmPick}
                disabled={submitting}
                className="btn-brand flex-1"
              >
                {submitting ? "Saving…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
