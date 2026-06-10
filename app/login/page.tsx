"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function errorMessage(code: string | null): string | null {
  if (!code) return null;
  switch (code) {
    case "AccessDenied":
      return "Use your Privilee account (@privilee.ae) to sign in.";
    case "CredentialsSignin":
      return "Sign-in failed. Use a valid @privilee.ae email.";
    default:
      return "Something went wrong signing in. Please try again.";
  }
}

function LoginInner() {
  const params = useSearchParams();
  const error = errorMessage(params.get("error"));
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const callbackUrl = params.get("callbackUrl") || "/games";

  function devSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    void signIn("dev", { email: email.trim(), callbackUrl });
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center">
      <div className="card p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand text-xl font-bold text-white">
            P
          </div>
          <h1 className="text-2xl font-bold">Privilee Bet</h1>
          <p className="mt-1 text-sm text-slate-500">
            Sign in to predict matches and climb the leaderboard.
          </p>
        </div>

        {error && (
          <div
            data-testid="login-error"
            role="alert"
            className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <button
          type="button"
          data-testid="google-signin"
          onClick={() => signIn("google", { callbackUrl })}
          className="btn-ghost w-full py-2.5"
        >
          <span aria-hidden>🟢</span> Sign in with Google
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          OR
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <form onSubmit={devSignIn} className="space-y-3">
          <label htmlFor="dev-email" className="block text-sm font-medium text-slate-700">
            Dev login
          </label>
          <input
            id="dev-email"
            data-testid="dev-email"
            type="email"
            inputMode="email"
            placeholder="you@privilee.ae"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            required
          />
          <button
            type="submit"
            data-testid="dev-signin"
            disabled={busy}
            className="btn-brand w-full py-2.5"
          >
            {busy ? "Signing in…" : "Continue"}
          </button>
          <p className="text-xs text-slate-400">
            Dev login (any @privilee.ae email; ha@privilee.ae is admin)
          </p>
        </form>
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
