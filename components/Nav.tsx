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
}

const LINKS = [
  { href: "/games", label: "Games" },
  { href: "/my-bets", label: "My Bets" },
  { href: "/pick-winner", label: "Pick Winner" },
  { href: "/leaderboard", label: "Leaderboard" },
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
          <div className="hidden items-center gap-2 sm:flex">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt=""
                className="h-8 w-8 rounded-full border border-slate-200"
              />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">
                {(user.name ?? user.email ?? "?").slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="max-w-[10rem] truncate text-sm text-slate-700">
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
