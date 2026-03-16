// src/lib/firebase.js
import { initializeApp, getApps } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const isBrowser = typeof window !== "undefined";

// Firebase must not initialize during Next.js server build/prerender.
let app = null;
let auth = null;
let db = null;

function ensureFirebase() {
  if (!isBrowser) return { app: null, auth: null, db: null };
  if (app && auth && db) return { app, auth, db };

  const existing = getApps();
  app = existing.length === 0 ? initializeApp(firebaseConfig) : existing[0];
  auth = getAuth(app);
  db = getFirestore(app);
  return { app, auth, db };
}

/**
 * Sign in anonymously — zero friction onboarding.
 * User upgrades to real account later if they choose.
 */
async function signInAnon() {
  try {
    const { auth } = ensureFirebase();
    if (!auth) throw new Error("Firebase Auth is not available on the server");
    const result = await signInAnonymously(auth);
    return result.user;
  } catch (err) {
    console.error("[Firebase] Anonymous sign-in failed:", err);
    throw err;
  }
}

/**
 * Get the current user's ID token for API calls.
 */
async function getIdToken() {
  const { auth } = ensureFirebase();
  if (!auth) throw new Error("Firebase Auth is not available on the server");
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  return user.getIdToken();
}

export { app, auth, db, signInAnon, getIdToken, onAuthStateChanged, ensureFirebase };
