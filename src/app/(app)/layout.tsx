"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingState } from "@/components/ui/States";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase/client";

/**
 * Layout for all authenticated screens (everything in the (app) route group).
 *
 * Firebase Auth is client-side, so this is a client component that guards the
 * protected area:
 *  1. While auth state is resolving, it shows a loading state.
 *  2. If nobody is signed in, it redirects to /login.
 *  3. Otherwise it renders the AppShell navigation around the page.
 */
export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, firebaseUser } = useAuth();
  const router = useRouter();
  const hadAuthenticatedUser = useRef(false);

  useEffect(() => {
    if (firebaseUser) {
      hadAuthenticatedUser.current = true;
    }
  }, [firebaseUser]);

  useEffect(() => {
    if (!isFirebaseConfigured || loading || firebaseUser) return;

    // Firebase can emit a brief null user during token/profile refreshes.
    // Give established sessions a longer grace period before redirecting.
    const delayMs = hadAuthenticatedUser.current ? 5_000 : 300;

    // Delay redirect and verify currentUser is still null to avoid false bounces.
    const redirectTimer = window.setTimeout(() => {
      if (!getFirebaseAuth().currentUser) {
        router.replace("/login");
      }
    }, delayMs);

    return () => window.clearTimeout(redirectTimer);
  }, [loading, firebaseUser, router]);

  // Friendly notice if the project hasn't been configured yet.
  if (!isFirebaseConfigured) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <h1 className="text-xl font-semibold text-ink-900">
          Firebase is not configured
        </h1>
        <p className="mt-2 text-sm text-ink-600">
          Copy <code>.env.local.example</code> to <code>.env.local</code>, add
          your <code>NEXT_PUBLIC_FIREBASE_*</code> values, then restart the dev
          server.
        </p>
      </div>
    );
  }

  // Still resolving auth, or about to redirect an unauthenticated visitor.
  if (loading || !firebaseUser) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState message="Loading…" />
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
