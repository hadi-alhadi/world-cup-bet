"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function FormInner() {
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/games";
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  function devSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    void signIn("dev", { email: email.trim(), callbackUrl });
  }

  return (
    <form onSubmit={devSignIn} className="space-y-3">
      <label htmlFor="dev-email" className="block text-sm font-medium text-slate-700">
        Email
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
        Any @privilee.ae email works; ha@privilee.ae is admin.
      </p>
    </form>
  );
}

export function DevLoginForm() {
  return (
    <Suspense fallback={null}>
      <FormInner />
    </Suspense>
  );
}
