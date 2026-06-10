// Separate dev/QA login route, kept off the main /login page to avoid confusion.
// Only functional when AUTH_DEV_MODE=true (set false in production); otherwise it shows
// a disabled notice and no form is rendered.
import Link from "next/link";
import { DevLoginForm } from "@/components/DevLoginForm";

export const dynamic = "force-dynamic";

export default function DevLoginPage() {
  const enabled = process.env.AUTH_DEV_MODE === "true";

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center">
      <div className="card p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-slate-800 text-xl font-bold text-white">
            ⚙︎
          </div>
          <h1 className="text-2xl font-bold">Dev / QA login</h1>
          <p className="mt-1 text-sm text-slate-500">
            Impersonate a seeded user without Google. Not for production.
          </p>
        </div>

        {enabled ? (
          <DevLoginForm />
        ) : (
          <div
            data-testid="dev-disabled"
            role="alert"
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          >
            Dev login is disabled (<code>AUTH_DEV_MODE</code> is off). Use{" "}
            <Link href="/login" className="font-medium underline">
              Google sign-in
            </Link>
            .
          </div>
        )}

        <p className="mt-5 text-center text-xs text-slate-400">
          <Link href="/login" className="underline">
            ← Back to normal sign-in
          </Link>
        </p>
      </div>
    </div>
  );
}
