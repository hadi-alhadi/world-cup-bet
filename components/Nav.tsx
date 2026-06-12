"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";

interface NavUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role: "USER" | "ADMIN";
  /** The user's champion pick, shown as a chip tucked behind the avatar. */
  pickedTeam?: { name: string; logoUrl: string | null } | null;
}

const LINKS = [
  { href: "/games", label: "Games" },
  { href: "/my-bets", label: "My Bets" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/badges", label: "Badges" },
];

export function Nav({ user }: { user: NavUser | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // No nav chrome on the login page / when signed out.
  if (!user) return null;

  const links = [
    ...LINKS,
    ...(user.role === "ADMIN" ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + "/");

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <Link href="/games" className="flex items-center gap-2 font-bold text-brand">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-sm text-white">
            P
          </span>
          <span className="hidden sm:inline">Privilee Bet</span>
        </Link>

        <ul className="ml-2 hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className={
                  "rounded-lg px-3 py-2 text-sm font-medium transition " +
                  (isActive(l.href)
                    ? "bg-brand/10 text-brand"
                    : "text-slate-600 hover:bg-slate-100")
                }
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2">
            {/* Avatar with the champion pick as a small badge on the bottom-left corner.
                The badge is the entry point to /pick-winner (team logo when picked, an
                inviting trophy when not). */}
            <span className="relative inline-block shrink-0">
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.image}
                  alt=""
                  className="h-8 w-8 rounded-full border border-slate-200 object-cover"
                />
              ) : (
                <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">
                  {(user.name ?? user.email ?? "?").slice(0, 1).toUpperCase()}
                </span>
              )}
              <Link
                href="/pick-winner"
                title={
                  user.pickedTeam
                    ? `Your champion: ${user.pickedTeam.name}`
                    : "Pick your champion"
                }
                aria-label={
                  user.pickedTeam
                    ? `Your champion: ${user.pickedTeam.name}. Change or view pick.`
                    : "Pick your champion"
                }
                className={
                  "absolute -bottom-1 -left-1 grid h-4 w-4 place-items-center overflow-hidden rounded-full border border-white shadow-sm transition hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand " +
                  (user.pickedTeam
                    ? "bg-white"
                    : "bg-amber-100 text-amber-600 hover:bg-amber-200")
                }
              >
                {user.pickedTeam ? (
                  user.pickedTeam.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.pickedTeam.logoUrl}
                      alt=""
                      className="h-4 w-4 object-cover"
                    />
                  ) : (
                    <span className="text-[8px] font-bold text-slate-700">
                      {user.pickedTeam.name.slice(0, 1)}
                    </span>
                  )
                ) : (
                  <span aria-hidden className="text-[9px] leading-none">
                    🏆
                  </span>
                )}
              </Link>
            </span>
            <span className="hidden max-w-[10rem] truncate text-sm text-slate-700 sm:inline">
              {user.name ?? user.email}
            </span>
          </div>
          <button
            type="button"
            data-testid="sign-out"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="btn-ghost px-3 py-1.5 text-xs"
          >
            Sign out
          </button>
          <button
            type="button"
            aria-label="Toggle menu"
            className="btn-ghost px-2 py-1.5 md:hidden"
            onClick={() => setOpen((o) => !o)}
          >
            ☰
          </button>
        </div>
      </nav>

      {open && (
        <ul className="border-t border-slate-200 bg-white px-4 py-2 md:hidden">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                onClick={() => setOpen(false)}
                className={
                  "block rounded-lg px-3 py-2 text-sm font-medium " +
                  (isActive(l.href)
                    ? "bg-brand/10 text-brand"
                    : "text-slate-600 hover:bg-slate-100")
                }
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}
