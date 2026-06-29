/**
 * Firebase client initialization.
 *
 * We read configuration from public environment variables so nothing sensitive
 * is hardcoded. See .env.local.example for the variables you need to set.
 *
 * The Firebase web "config" values (apiKey, appId, etc.) are NOT secrets — they
 * identify your project to Google and are safe to expose in the browser. Access
 * is controlled by Firebase Authentication and Firestore security rules.
 */
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  type Auth,
  type User,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * True when the minimum required Firebase config is present. The app uses this
 * to show a friendly "not configured" message instead of crashing before you
 * have added your .env.local file.
 */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.appId,
);

/** Initializes (or reuses) the Firebase app. Throws if config is missing. */
function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured) {
    throw new Error(
      "Firebase is not configured. Add the NEXT_PUBLIC_FIREBASE_* variables " +
        "to your .env.local file.",
    );
  }
  return getApps().length
    ? getApp()
    : initializeApp(firebaseConfig as Record<string, string>);
}

/** Returns the Firebase Auth instance. */
export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

/** Returns the Cloud Firestore instance. */
export function getDb(): Firestore {
  return getFirestore(getFirebaseApp());
}

/** Returns the Cloud Storage instance (used for completion photos). */
export function getFirebaseStorage(): FirebaseStorage {
  return getStorage(getFirebaseApp());
}

/**
 * Ensures there is a signed-in Firebase user, signing in anonymously if needed.
 *
 * Contractors open tokenized action links without an account, but Firestore
 * security rules require an authenticated request to read/write the scoped
 * data. A lightweight anonymous sign-in satisfies the rules while the action
 * link itself controls what the contractor is allowed to do.
 *
 * Requires the Anonymous sign-in provider to be enabled in Firebase Auth.
 */
export async function ensureAnonymousSession(): Promise<User> {
  const auth = getFirebaseAuth();
  if (auth.currentUser) return auth.currentUser;
  const cred = await signInAnonymously(auth);
  return cred.user;
}
