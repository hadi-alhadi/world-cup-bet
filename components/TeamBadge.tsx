"use client";

import type { TeamDTO } from "@/lib/types";

export function TeamLogo({
  team,
  size = 32,
}: {
  team: Pick<TeamDTO, "name" | "logoUrl">;
  size?: number;
}) {
  if (team.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={team.logoUrl}
        alt=""
        width={size}
        height={size}
        className="object-contain"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="grid place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-500"
      style={{ width: size, height: size }}
    >
      {team.name.slice(0, 2).toUpperCase()}
    </span>
  );
}
