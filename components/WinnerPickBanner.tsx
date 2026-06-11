"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface Status {
  hasPicked: boolean;
  deadline: string | null;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

// Sticky red nudge shown to signed-in users who haven't picked a champion, counting down
// to the pick deadline. Disappears once they pick or the window closes.
export function WinnerPickBanner() {
  const [status, setStatus] = useState<Status | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const pathname = usePathname();

  const load = useCallback(() => {
    fetch("/api/winner-pick/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setStatus(d))
      .catch(() => {});
  }, []);

  // Re-check on mount, on every client-side navigation, and when a pick is made
  // (the banner lives in the persistent layout, so it never remounts on its own).
  useEffect(() => {
    load();
  }, [load, pathname]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener("winner-pick-updated", handler);
    return () => window.removeEventListener("winner-pick-updated", handler);
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!status || status.hasPicked) return null;

  const target = status.deadline ? new Date(status.deadline).getTime() : null;
  const remaining = target != null ? target - now : null;

  // Window already closed → no point nudging.
  if (remaining != null && remaining <= 0) return null;

  let countdown: string | null = null;
  if (remaining != null) {
    const s = Math.floor(remaining / 1000);
    countdown = `${pad(Math.floor(s / 3600))}h ${pad(Math.floor((s % 3600) / 60))}m ${pad(s % 60)}s`;
  }

  return (
    <div data-testid="winner-pick-banner" className="bg-red-600 text-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2.5 text-center text-sm font-medium">
        <span>🏆 You haven&apos;t picked your champion yet — it&apos;s worth 6 points!</span>
        {countdown && (
          <span data-testid="winner-pick-countdown" className="font-bold tabular-nums">
            ⏳ Closes in {countdown}
          </span>
        )}
        <Link
          href="/pick-winner"
          className="rounded-full bg-white px-3 py-1 text-xs font-bold text-red-600 transition hover:bg-red-50"
        >
          Pick now →
        </Link>
      </div>
    </div>
  );
}
