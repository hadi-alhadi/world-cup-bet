"use client";

import { useState } from "react";
import type { FixtureDTO } from "@/lib/types";
import { TeamLogo } from "@/components/TeamBadge";
import { useToast } from "@/components/Toast";
import { Spinner, EmptyState, ErrorState, useApi } from "@/components/state";
import { fmtShort } from "@/components/format";

function ResultRow({
  fixture,
  onSaved,
}: {
  fixture: FixtureDTO;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [home, setHome] = useState<number>(fixture.homeScore ?? 0);
  const [away, setAway] = useState<number>(fixture.awayScore ?? 0);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fixtureId: fixture.id,
          homeScore: home,
          awayScore: away,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast(body?.error?.message ?? "Could not save result.", "error");
        return;
      }
      toast(`Result saved: ${fixture.homeTeam.name} ${home}–${away} ${fixture.awayTeam.name}`, "success");
      onSaved();
    } catch {
      toast("Network error — please retry.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-3 border-b border-slate-50 py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-slate-400">
          {fixture.round ?? "Fixture"} · {fmtShort(fixture.kickoffAt)}
          {fixture.status === "FINISHED" && (
            <span className="ml-1 font-semibold text-brand">· finalized</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <TeamLogo team={fixture.homeTeam} size={20} />
          <span className="truncate">{fixture.homeTeam.name}</span>
          <span className="text-slate-300">vs</span>
          <span className="truncate">{fixture.awayTeam.name}</span>
          <TeamLogo team={fixture.awayTeam} size={20} />
        </div>
      </div>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          aria-label={`${fixture.homeTeam.name} score`}
          data-testid={`result-home-${fixture.id}`}
          value={home}
          onChange={(e) => setHome(Math.max(0, Number(e.target.value)))}
          className="input w-14 text-center"
        />
        <span className="font-bold text-slate-300">:</span>
        <input
          type="number"
          min={0}
          aria-label={`${fixture.awayTeam.name} score`}
          data-testid={`result-away-${fixture.id}`}
          value={away}
          onChange={(e) => setAway(Math.max(0, Number(e.target.value)))}
          className="input w-14 text-center"
        />
        <button
          type="button"
          data-testid={`result-save-${fixture.id}`}
          onClick={submit}
          disabled={saving}
          className="btn-brand ml-1 px-3 py-2"
        >
          {saving ? "…" : "Save"}
        </button>
      </div>
    </li>
  );
}

export function ResultsPanel() {
  // Admin scores 90' results; show all fixtures so corrections to finished ones are possible.
  const { data, loading, error, reload } = useApi<FixtureDTO[]>("/api/fixtures?filter=all");

  return (
    <section className="card p-5">
      <h2 className="mb-3 text-lg font-bold">Enter Results</h2>
      {loading && <Spinner label="Loading fixtures…" />}
      {error && !loading && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (data?.length ?? 0) === 0 && (
        <EmptyState title="No fixtures to score" hint="Run a sync to load fixtures." />
      )}
      {!loading && !error && (data?.length ?? 0) > 0 && (
        <ul>
          {data!.map((f) => (
            <ResultRow key={f.id} fixture={f} onSaved={reload} />
          ))}
        </ul>
      )}
    </section>
  );
}
