import Link from "next/link";

/**
 * Public landing page.
 * Its main job for Sprint 1 is to confirm that PhaseBinder is running and to
 * point the user toward the login screen. It does not require authentication.
 */
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl text-center">
        {/* Small status pill confirming the app is up */}
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
          <span className="h-2 w-2 rounded-full bg-brand-600" />
          PhaseBinder is running
        </span>

        <h1 className="mt-6 text-4xl font-bold tracking-tight text-ink-900 sm:text-5xl">
          PhaseBinder
        </h1>
        <p className="mt-4 text-lg text-ink-600">
          A mobile-first construction workflow app for trade readiness, material
          tracking, completion proof, and document control.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/login"
            className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-brand-600 px-6 font-medium text-white transition-colors hover:bg-brand-700 sm:w-auto"
          >
            Sign in
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-ink-200 bg-surface px-6 font-medium text-ink-700 transition-colors hover:bg-ink-50 sm:w-auto"
          >
            Go to dashboard
          </Link>
        </div>

        <p className="mt-10 text-sm text-ink-400">Sprint 1 foundation build</p>
      </div>
    </main>
  );
}
