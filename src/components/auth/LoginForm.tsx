"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  type AuthError,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDb, getFirebaseAuth } from "@/lib/firebase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { DEFAULT_ROLE } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { ErrorAlert } from "@/components/ui/States";

type Mode = "signin" | "signup";

/**
 * Email/password login form backed by Firebase Authentication.
 *
 * Supports two modes:
 *  - "signin": existing users log in.
 *  - "signup": create a new account. We also write a Firestore `users/{uid}`
 *    profile document with the default role.
 *
 * On success it redirects to the originally requested page (or the dashboard).
 * If the visitor is already signed in, it redirects them away from /login.
 */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/dashboard";
  const { firebaseUser } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in? Don't show the form — go to the app.
  useEffect(() => {
    if (firebaseUser) router.replace(redirectTo);
  }, [firebaseUser, redirectTo, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const auth = getFirebaseAuth();

      if (mode === "signin") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const cred = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );
        // Set the display name on the auth profile.
        if (fullName.trim()) {
          await updateProfile(cred.user, { displayName: fullName.trim() });
        }
        // Create the Firestore profile document with the default role.
        await setDoc(doc(getDb(), "users", cred.user.uid), {
          email: cred.user.email,
          full_name: fullName.trim(),
          role: DEFAULT_ROLE,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });
      }

      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <ErrorAlert message={error} />}

      {mode === "signup" && (
        <Field label="Full name" htmlFor="fullName">
          <Input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jordan Smith"
            autoComplete="name"
          />
        </Field>
      )}

      <Field label="Email" htmlFor="email" required>
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          autoComplete="email"
        />
      </Field>

      <Field label="Password" htmlFor="password" required>
        <Input
          id="password"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
        />
      </Field>

      <Button type="submit" loading={loading} className="w-full" size="lg">
        {mode === "signin" ? "Sign in" : "Create account"}
      </Button>

      <p className="text-center text-sm text-ink-500">
        {mode === "signin" ? "New to TradeFlow?" : "Already have an account?"}{" "}
        <button
          type="button"
          className="font-medium text-brand-600 hover:text-brand-700"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
          }}
        >
          {mode === "signin" ? "Create one" : "Sign in"}
        </button>
      </p>
    </form>
  );
}

/** Maps common Firebase auth error codes to readable messages. */
function friendlyAuthError(err: unknown): string {
  const code = (err as AuthError)?.code;
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password.";
    case "auth/email-already-in-use":
      return "An account with that email already exists.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/invalid-email":
      return "That email address looks invalid.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    default:
      return err instanceof Error ? err.message : "Something went wrong.";
  }
}
