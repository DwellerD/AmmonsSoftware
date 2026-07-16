"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import {
  getDb,
  getFirebaseAuth,
  isFirebaseConfigured,
} from "@/lib/firebase/client";
import { canManage as canManageRole, DEFAULT_ROLE } from "@/lib/constants";
import type { Profile, UserRole } from "@/lib/database.types";

/**
 * AuthProvider tracks the Firebase Auth state and the signed-in user's profile
 * (which holds their role). It is mounted once at the root so any client
 * component can call useAuth().
 *
 * Auth in Firebase is client-side, so this listens to onAuthStateChanged and
 * loads the matching Firestore `users/{uid}` document for the role. If that
 * document is missing (e.g. an account created elsewhere), it creates one with
 * the default role so the app always has a profile to work with.
 */
interface AuthValue {
  /** True while we are still determining whether someone is signed in. */
  loading: boolean;
  /** True when Firebase env config is present. */
  configured: boolean;
  /** The Firebase auth user, or null if signed out. */
  firebaseUser: User | null;
  userId: string | null;
  email: string | null;
  profile: Profile | null;
  role: UserRole | null;
  /** True if the role may manage projects/trades/contractors/phases. */
  canManage: boolean;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const authTransitionRef = useRef(0);

  useEffect(() => {
    // Without config we can't talk to Firebase; stop the loading spinner.
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const transitionId = ++authTransitionRef.current;
      setLoading(true);
      setProfile(null);

      let nextUser = user;
      if (
        !nextUser &&
        "authStateReady" in auth &&
        typeof auth.authStateReady === "function"
      ) {
        await auth.authStateReady();
        nextUser = auth.currentUser;
      }

      setFirebaseUser(nextUser);

      if (!nextUser) {
        setLoading(false);
        return;
      }

      // Load (or lazily create) the user's profile document.
      try {
        const db = getDb();
        const ref = doc(db, "users", nextUser.uid);
        const snap = await getDoc(ref);

        if (
          transitionId !== authTransitionRef.current ||
          auth.currentUser?.uid !== nextUser.uid
        ) {
          return;
        }

        if (snap.exists()) {
          const data = snap.data();
          setProfile({
            id: nextUser.uid,
            email: nextUser.email,
            full_name: data.full_name ?? nextUser.displayName ?? null,
            role: (data.role as UserRole) ?? DEFAULT_ROLE,
            created_at: tsToIso(data.created_at),
            updated_at: tsToIso(data.updated_at),
          });
        } else {
          await setDoc(ref, {
            email: nextUser.email,
            full_name: nextUser.displayName ?? "",
            role: DEFAULT_ROLE,
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
          });
          if (
            transitionId !== authTransitionRef.current ||
            auth.currentUser?.uid !== nextUser.uid
          ) {
            return;
          }
          setProfile({
            id: nextUser.uid,
            email: nextUser.email,
            full_name: nextUser.displayName ?? null,
            role: DEFAULT_ROLE,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      } catch (err) {
        if (transitionId === authTransitionRef.current) {
          console.warn("Failed to load profile:", err);
          setProfile(null);
        }
      } finally {
        if (transitionId === authTransitionRef.current) {
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const value = useMemo<AuthValue>(() => {
    const role = profile?.role ?? null;
    return {
      loading,
      configured: isFirebaseConfigured,
      firebaseUser,
      userId: firebaseUser?.uid ?? null,
      email: firebaseUser?.email ?? null,
      profile,
      role,
      canManage: canManageRole(role),
    };
  }, [loading, firebaseUser, profile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Hook to read the current auth state (user, role, permissions). */
export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return ctx;
}

/** Converts a Firestore Timestamp (or string) to an ISO date string. */
function tsToIso(value: unknown): string {
  if (!value) return new Date().toISOString();
  if (typeof value === "string") return value;
  if (
    typeof value === "object" &&
    value !== null &&
    "seconds" in (value as Record<string, unknown>)
  ) {
    const seconds = (value as { seconds: number }).seconds;
    return new Date(seconds * 1000).toISOString();
  }
  return new Date(value as string).toISOString();
}
