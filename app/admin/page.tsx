"use client";

import { useEffect, useState } from "react";
import type { TeamDTO } from "@/lib/types";
import { TeamLogo } from "@/components/TeamBadge";
import { useToast } from "@/components/Toast";
import { Spinner, ErrorState, useApi } from "@/components/state";
import { ResultsPanel } from "@/components/admin/ResultsPanel";

interface SettingsDTO {
  round_open_before_hours: string | null;
  bet_close_before_hours: string | null;
  winner_pick_deadline: string | null;
  tournament_winner_team_id: string | null;
}

// Convert an ISO datetime to the value a <input type="datetime-local"> expects (local).
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function SettingsPanel() {
  const { toast } = useToast();
  const { data, loading, error, reload } = useApi<SettingsDTO>("/api/admin/settings");

  const [openH, setOpenH] = useState("");
  const [closeH, setCloseH] = useState("");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setOpenH(data.round_open_before_hours ?? "48");
      setCloseH(data.bet_close_before_hours ?? "2");
      setDeadline(isoToLocalInput(data.winner_pick_deadline));
    }
  }, [data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      if (openH) payload.roundOpenBeforeHours = Number(openH);
      if (closeH) payload.betCloseBeforeHours = Number(closeH);
      if (deadline) payload.winnerPickDeadline = new Date(deadline).toISOString();

      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast(body?.error?.message ?? "Could not save settings.", "error");
        return;
      }
      toast("Settings saved", "success");
      await reload();
    } catch {
      toast("Network error — please retry.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card p-5">
      <h2 className="mb-3 text-lg font-bold">Settings</h2>
      {loading && <Spinner label="Loading settings…" />}
      {error && !loading && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600">
                Round opens (hours before round start)
              </span>
              <input
                type="number"
                min={1}
                data-testid="setting-open-hours"
                value={openH}
                onChange={(e) => setOpenH(e.target.value)}
                className="input"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600">
                Bet closes (hours before kickoff)
              </span>
              <input
                type="number"
                min={1}
                data-testid="setting-close-hours"
                value={closeH}
                onChange={(e) => setCloseH(e.target.value)}
                className="input"
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-600">
              Champion pick deadline
            </span>
            <input
              type="datetime-local"
              data-testid="setting-winner-deadline"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="input"
            />
          </label>
          <button
            type="submit"
            data-testid="settings-save"
            disabled={saving}
            className="btn-brand"
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
        </form>
      )}
    </section>
  );
}

function SyncPanel() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function sync() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/sync", { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast(body?.error?.message ?? "Sync failed.", "error");
        return;
      }
      const counts = body
        ? Object.entries(body)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ")
        : "";
      toast(`Sync complete${counts ? ` (${counts})` : ""}`, "success");
    } catch {
      toast("Network error — please retry.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card flex flex-wrap items-center justify-between gap-3 p-5">
      <div>
        <h2 className="text-lg font-bold">Fixture Sync</h2>
        <p className="text-sm text-slate-500">Pull the latest teams & fixtures from the data provider.</p>
      </div>
      <button
        type="button"
        data-testid="sync-button"
        onClick={sync}
        disabled={busy}
        className="btn-brand"
      >
        {busy ? "Syncing…" : "Run sync"}
      </button>
    </section>
  );
}

function DicePanel() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/dice", { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast(body?.error?.message ?? "Dice run failed.", "error");
        return;
      }
      const parts = [`placed ${body.betsPlaced} bet${body.betsPlaced === 1 ? "" : "s"}`];
      if (body.championPicked) parts.push(`picked ${body.championPicked}`);
      toast(`🎲 Dice ${parts.join(" · ")}`, "success");
    } catch {
      toast("Network error — please retry.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card flex flex-wrap items-center justify-between gap-3 p-5">
      <div>
        <h2 className="text-lg font-bold">🎲 Dice bot</h2>
        <p className="text-sm text-slate-500">
          Place random predictions on every open game (and a champion) for the Dice
          leaderboard player. Safe to run repeatedly — it only bets on new games.
        </p>
      </div>
      <button
        type="button"
        data-testid="dice-button"
        onClick={run}
        disabled={busy}
        className="btn-brand"
      >
        {busy ? "Rolling…" : "Run Dice"}
      </button>
    </section>
  );
}

function TournamentWinnerPanel() {
  const { toast } = useToast();
  const teamsApi = useApi<TeamDTO[]>("/api/winner-pick/teams");
  const [selected, setSelected] = useState<number | "">("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (selected === "") {
      toast("Choose a team first", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/tournament-winner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: Number(selected) }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast(body?.error?.message ?? "Could not set winner.", "error");
        return;
      }
      toast("Tournament winner set — champion picks scored 🏆", "success");
    } catch {
      toast("Network error — please retry.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-5">
      <h2 className="mb-1 text-lg font-bold">Set Tournament Winner</h2>
      <p className="mb-3 text-sm text-slate-500">
        Finalizing the champion awards 6 points to everyone who picked correctly.
      </p>
      {teamsApi.loading && <Spinner label="Loading teams…" />}
      {teamsApi.error && !teamsApi.loading && (
        <ErrorState message={teamsApi.error} onRetry={teamsApi.reload} />
      )}
      {!teamsApi.loading && !teamsApi.error && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <select
              data-testid="winner-select"
              value={selected}
              onChange={(e) =>
                setSelected(e.target.value === "" ? "" : Number(e.target.value))
              }
              className="input w-56"
            >
              <option value="">Select team…</option>
              {teamsApi.data!.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {selected !== "" &&
              (() => {
                const t = teamsApi.data!.find((x) => x.id === selected);
                return t ? <TeamLogo team={t} size={28} /> : null;
              })()}
          </div>
          <button
            type="button"
            data-testid="set-winner"
            onClick={submit}
            disabled={busy}
            className="btn-brand"
          >
            {busy ? "Saving…" : "Set winner"}
          </button>
        </div>
      )}
    </section>
  );
}

export default function AdminPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Admin</h1>
      <ResultsPanel />
      <SettingsPanel />
      <SyncPanel />
      <DicePanel />
      <TournamentWinnerPanel />
    </div>
  );
}
