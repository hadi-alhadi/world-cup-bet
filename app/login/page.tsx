"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function errorMessage(code: string | null): string | null {
  if (!code) return null;
  switch (code) {
    case "AccessDenied":
      return "Use your Privilee account (privilee.ae or privilee.com) to sign in.";
    case "CredentialsSignin":
      return "Sign-in failed. Use a valid @privilee.ae or @privilee.com email.";
    default:
      return "Something went wrong signing in. Please try again.";
  }
}

function LoginInner() {
  const params = useSearchParams();
  const error = errorMessage(params.get("error"));
  const callbackUrl = params.get("callbackUrl") || "/games";

  return (
    // Mobile: full-bleed photo with a glassy form floating over it.
    // md+: split screen — photo left (60%), white form panel right (40%).
    <div className="fixed inset-0 bg-brand-dark md:flex">
      {/* Image panel — full screen on mobile, left column on desktop */}
      <div className="absolute inset-0 overflow-hidden md:relative md:inset-auto md:w-3/5">
        <img
          src="/login-bg.jpg"
          alt=""
          aria-hidden
          className="h-full w-full object-cover object-[center_22%] md:object-center"
        />
        {/* Scrim: bottom-heavy on mobile for form legibility; brand tint on desktop. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/20 md:from-brand-dark/85 md:via-black/25 md:to-black/30" />
        {/* Desktop-only caption over the photo */}
        <div className="absolute inset-0 hidden flex-col justify-end p-10 text-white md:flex">
          <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-white/15 text-xl font-bold ring-1 ring-white/30 backdrop-blur">
            P
          </div>
          <h2 className="text-3xl font-bold leading-tight drop-shadow">Privilee Bet</h2>
          <p className="mt-2 max-w-sm text-sm text-white/90 drop-shadow">
            Predict every match of the World Cup, call the champion, and climb the
            leaderboard against your colleagues.
          </p>
        </div>
      </div>

      {/* Form panel — floats over the photo (bottom) on mobile; white column on desktop */}
      <div className="absolute inset-x-0 bottom-0 p-6 pb-10 md:relative md:inset-auto md:flex md:flex-1 md:items-center md:justify-center md:bg-white md:p-10">
        <div className="w-full max-w-sm text-center md:text-left">
          <div className="mb-6">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-white/15 text-xl font-bold text-white ring-1 ring-white/30 backdrop-blur md:bg-brand md:text-white md:ring-0 md:backdrop-blur-none">
              P
            </div>
            <h1 className="text-2xl font-bold text-white drop-shadow md:text-ink md:drop-shadow-none">
              Welcome back
            </h1>
            <p className="mt-1 text-sm text-white/85 drop-shadow md:text-slate-500 md:drop-shadow-none">
              Sign in with your Privilee account to predict matches and climb the
              leaderboard.
            </p>
          </div>

          {error && (
            <div
              data-testid="login-error"
              role="alert"
              className="mb-4 rounded-xl border border-red-300/60 bg-red-50/90 px-4 py-3 text-sm text-red-700 backdrop-blur md:bg-red-50"
            >
              {error}
            </div>
          )}

          <button
            type="button"
            data-testid="google-signin"
            onClick={() => signIn("google", { callbackUrl })}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/40 bg-white/15 py-3 font-semibold text-white shadow-lg backdrop-blur-md transition hover:bg-white/25 hover:shadow-xl active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 md:border-slate-200 md:bg-white md:py-2.5 md:text-ink md:shadow-sm md:backdrop-blur-none md:hover:bg-slate-50 md:focus-visible:ring-brand"
          >
            <span aria-hidden>🟢</span> Sign in with Google
          </button>

          <p className="mt-4 text-xs text-white/70 drop-shadow md:text-slate-400 md:drop-shadow-none">
            Only @privilee.ae and @privilee.com accounts can sign in.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
