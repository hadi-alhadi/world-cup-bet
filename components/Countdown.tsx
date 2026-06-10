"use client";

import { useEffect, useState } from "react";

/**
 * Live ticking countdown to an ISO target. Renders e.g. "closes in 2d 4h 13m".
 * Once the target passes it renders the `passedLabel` (or nothing).
 */
export function Countdown({
  to,
  prefix = "",
  passedLabel = "",
  className = "",
}: {
  to: string;
  prefix?: string;
  passedLabel?: string;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = new Date(to).getTime() - now;
  if (diff <= 0) {
    return passedLabel ? <span className={className}>{passedLabel}</span> : null;
  }

  const s = Math.floor(diff / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  let label: string;
  if (d > 0) label = `${d}d ${h}h ${m}m`;
  else if (h > 0) label = `${h}h ${m}m`;
  else if (m > 0) label = `${m}m ${sec}s`;
  else label = `${sec}s`;

  return (
    <span className={className} suppressHydrationWarning>
      {prefix}
      {label}
    </span>
  );
}
