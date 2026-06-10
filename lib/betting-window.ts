// Betting window logic (handoff §5). Pure functions — server-authoritative.
import type { Fixture } from "@prisma/client";
import type { WindowState } from "@/lib/types";
import type { WindowSettings } from "@/lib/settings";

const HOUR_MS = 60 * 60 * 1000;

export interface Window {
  opensAt: Date;
  closesAt: Date;
}

export function getWindow(fixture: Pick<Fixture, "kickoffAt">, s: WindowSettings): Window {
  const kickoff = fixture.kickoffAt.getTime();
  return {
    opensAt: new Date(kickoff - s.openBeforeHours * HOUR_MS),
    closesAt: new Date(kickoff - s.closeBeforeHours * HOUR_MS),
  };
}

// canBet(now, fixture) = status==SCHEDULED && opensAt <= now < closesAt
export function canBet(
  now: Date,
  fixture: Pick<Fixture, "kickoffAt" | "status">,
  s: WindowSettings,
): boolean {
  if (fixture.status !== "SCHEDULED") return false;
  const { opensAt, closesAt } = getWindow(fixture, s);
  return opensAt.getTime() <= now.getTime() && now.getTime() < closesAt.getTime();
}

export function windowState(
  now: Date,
  fixture: Pick<Fixture, "kickoffAt" | "status">,
  s: WindowSettings,
): WindowState {
  const { opensAt, closesAt } = getWindow(fixture, s);
  let reason: WindowState["reason"];
  if (fixture.status !== "SCHEDULED") reason = "NOT_SCHEDULED";
  else if (now.getTime() < opensAt.getTime()) reason = "NOT_OPEN_YET";
  else if (now.getTime() >= closesAt.getTime()) reason = "CLOSED";
  else reason = "OPEN";
  return {
    opensAt: opensAt.toISOString(),
    closesAt: closesAt.toISOString(),
    canBet: reason === "OPEN",
    reason,
  };
}
