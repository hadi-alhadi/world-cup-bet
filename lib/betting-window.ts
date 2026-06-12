// Betting window logic (handoff §5, round-based open). Server-authoritative.
//   opensAt  = (round's first kickoff − roundOpenBeforeHours)   [whole round opens together]
//   closesAt = (this match's kickoff − closeBeforeHours)        [per-match close]
// roundOpensAt is the precomputed open time for the fixture's round (see getRoundOpens).
// When absent (fixture has no round), we fall back to a per-match open (openBeforeHours).
import type { Fixture } from "@prisma/client";
import type { WindowState } from "@/lib/types";
import { prisma } from "@/lib/prisma";
import type { WindowSettings } from "@/lib/settings";

const HOUR_MS = 60 * 60 * 1000;

export interface Window {
  opensAt: Date;
  closesAt: Date;
}

export function getWindow(
  fixture: Pick<Fixture, "kickoffAt">,
  s: WindowSettings,
  roundOpensAt?: Date | null,
): Window {
  const kickoff = fixture.kickoffAt.getTime();
  return {
    opensAt: roundOpensAt ?? new Date(kickoff - s.openBeforeHours * HOUR_MS),
    closesAt: new Date(kickoff - s.closeBeforeHours * HOUR_MS),
  };
}

// canBet = status==SCHEDULED && opensAt <= now < closesAt
export function canBet(
  now: Date,
  fixture: Pick<Fixture, "kickoffAt" | "status">,
  s: WindowSettings,
  roundOpensAt?: Date | null,
): boolean {
  if (fixture.status !== "SCHEDULED") return false;
  const { opensAt, closesAt } = getWindow(fixture, s, roundOpensAt);
  return opensAt.getTime() <= now.getTime() && now.getTime() < closesAt.getTime();
}

export function windowState(
  now: Date,
  fixture: Pick<Fixture, "kickoffAt" | "status">,
  s: WindowSettings,
  roundOpensAt?: Date | null,
): WindowState {
  const { opensAt, closesAt } = getWindow(fixture, s, roundOpensAt);
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

// Map of roundKey -> the moment that round opens for betting (= earliest kickoff in the
// round − roundOpenBeforeHours). One groupBy query; callers look up a fixture's round.
export async function getRoundOpens(roundOpenBeforeHours: number): Promise<Map<string, Date>> {
  const rows = await prisma.fixture.groupBy({
    by: ["roundKey"],
    where: { roundKey: { not: null } },
    _min: { kickoffAt: true },
  });
  const map = new Map<string, Date>();
  for (const r of rows) {
    if (r.roundKey && r._min.kickoffAt) {
      map.set(r.roundKey, new Date(r._min.kickoffAt.getTime() - roundOpenBeforeHours * HOUR_MS));
    }
  }
  return map;
}
