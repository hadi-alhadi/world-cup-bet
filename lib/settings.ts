// Admin-editable settings (handoff §6). Stored as strings in the Setting table.
import { prisma } from "@/lib/prisma";

export const SETTING_KEYS = {
  betOpenBeforeHours: "bet_open_before_hours",
  betCloseBeforeHours: "bet_close_before_hours",
  winnerPickDeadline: "winner_pick_deadline",
  tournamentWinnerTeamId: "tournament_winner_team_id",
} as const;

export const SETTING_DEFAULTS: Record<string, string> = {
  [SETTING_KEYS.betOpenBeforeHours]: "168", // 7 days
  [SETTING_KEYS.betCloseBeforeHours]: "2",
  // winner_pick_deadline & tournament_winner_team_id have no default (unset).
};

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  if (row) return row.value;
  return SETTING_DEFAULTS[key] ?? null;
}

export async function getSettingNumber(key: string, fallback: number): Promise<number> {
  const raw = await getSetting(key);
  if (raw == null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export interface WindowSettings {
  openBeforeHours: number;
  closeBeforeHours: number;
}

// Read settings fresh each call so changes take effect without restart (§13).
export async function getWindowSettings(): Promise<WindowSettings> {
  const [openBeforeHours, closeBeforeHours] = await Promise.all([
    getSettingNumber(SETTING_KEYS.betOpenBeforeHours, 168),
    getSettingNumber(SETTING_KEYS.betCloseBeforeHours, 2),
  ]);
  return { openBeforeHours, closeBeforeHours };
}

export async function getWinnerPickDeadline(): Promise<Date | null> {
  const raw = await getSetting(SETTING_KEYS.winnerPickDeadline);
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

export async function getTournamentWinnerTeamId(): Promise<number | null> {
  const raw = await getSetting(SETTING_KEYS.tournamentWinnerTeamId);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
