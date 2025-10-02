import { initializeApp } from "firebase/app";
import {
  getAnalytics,
  isSupported as isAnalyticsSupported,
  type Analytics,
} from "firebase/analytics";
import {
  getAuth,
  GoogleAuthProvider,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  setPersistence,
  type Persistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

import firebaseConfig from "./config";

const app = initializeApp(firebaseConfig);

let analyticsPromise: Promise<Analytics | null> | null = null;

const projectAuth = getAuth(app);
const projectFirestore = getFirestore(app);
const projectGoogleAuth = new GoogleAuthProvider();

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

export {
  app,
  projectAuth,
  projectFirestore,
  projectGoogleAuth,
  authPersistence,
  applyAuthPersistence,
  getAnalyticsIfAvailable,
};
