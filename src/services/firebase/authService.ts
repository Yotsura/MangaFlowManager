import { initializeApp } from "firebase/app";
import {
  getAnalytics,
  isSupported as isAnalyticsSupported,
  type Analytics,
} from "firebase/analytics";
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  browserLocalPersistence,
  browserSessionPersistence,
  connectAuthEmulator,
  inMemoryPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type Auth,
  type Persistence,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from "firebase/firestore";

import firebaseConfig from "./config";

const app = initializeApp(firebaseConfig);

let analyticsPromise: Promise<Analytics | null> | null = null;

const projectAuth: Auth = getAuth(app);
const projectFirestore: Firestore = getFirestore(app);
const projectGoogleAuth = new GoogleAuthProvider();

const shouldUseEmulators =
  import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true";

if (shouldUseEmulators) {
  connectAuthEmulator(projectAuth, "http://localhost:9099", {
    disableWarnings: true,
  });
  connectFirestoreEmulator(projectFirestore, "localhost", 8080);
}

const authPersistence = {
  LOCAL: browserLocalPersistence,
  SESSION: browserSessionPersistence,
  NONE: inMemoryPersistence,
} as const;

const applyAuthPersistence = (persistence: Persistence = authPersistence.LOCAL) =>
  setPersistence(projectAuth, persistence);

const getAnalyticsIfAvailable = async (): Promise<Analytics | null> => {
  if (!analyticsPromise) {
    analyticsPromise = (async () => {
      if (!(await isAnalyticsSupported())) {
        return null;
      }

      return getAnalytics(app);
    })();
  }

  return analyticsPromise;
};

const signInWithEmail = (email: string, password: string) =>
  signInWithEmailAndPassword(projectAuth, email, password);

const registerWithEmail = (email: string, password: string) =>
  createUserWithEmailAndPassword(projectAuth, email, password);

const signInWithGoogle = () => signInWithPopup(projectAuth, projectGoogleAuth);

const signOutFromFirebase = () => signOut(projectAuth);

export {
  app,
  projectAuth,
  projectFirestore,
  projectGoogleAuth,
  authPersistence,
  applyAuthPersistence,
  getAnalyticsIfAvailable,
  onAuthStateChanged,
  signInWithEmail,
  registerWithEmail,
  signInWithGoogle,
  signOutFromFirebase,
};
