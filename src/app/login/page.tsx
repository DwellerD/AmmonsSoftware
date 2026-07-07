import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";
import { Card, CardBody } from "@/components/ui/Card";
import { isFirebaseConfigured } from "@/lib/firebase/client";

/**
 * The public login screen.
 * If Firebase has not been configured yet, we show setup instructions instead
 * of a broken form.
 */
export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Link href="/" className="text-2xl font-bold text-ink-900">
            PhaseBinder
          </Link>
          <p className="mt-1 text-sm text-ink-500">
            Sign in to manage your projects
          </p>
        </div>

        <Card>
          <CardBody>
            {isFirebaseConfigured ? (
              // useSearchParams() needs a Suspense boundary in the App Router.
              <Suspense fallback={<p className="text-sm text-ink-500">Loading…</p>}>
                <LoginForm />
              </Suspense>
            ) : (
              <div className="space-y-2 text-sm text-ink-600">
                <p className="font-medium text-ink-900">
                  Firebase is not configured yet.
                </p>
                <p>
                  Copy <code>.env.local.example</code> to{" "}
                  <code>.env.local</code> and add your{" "}
                  <code>NEXT_PUBLIC_FIREBASE_*</code> values, then restart the
                  dev server.
                </p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
