"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

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
  const callbackUrl = params.get("callbackUrl") || "/games";

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center">
      <div className="card p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand text-xl font-bold text-white">
            P
          </div>
          <h1 className="text-2xl font-bold">Privilee Bet</h1>
          <p className="mt-1 text-sm text-slate-500">
            Sign in with your Privilee account to predict matches and climb the leaderboard.
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

        <p className="mt-4 text-center text-xs text-slate-400">
          Only @privilee.ae accounts can sign in.
        </p>
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
