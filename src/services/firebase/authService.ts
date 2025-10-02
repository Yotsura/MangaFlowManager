import { createUserWithEmailAndPassword, onAuthStateChanged as firebaseOnAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut, type NextOrObserver, type User } from "firebase/auth";

import {
  app,
  authPersistence,
  applyAuthPersistence,
  getAnalyticsIfAvailable,
  projectAuth,
  projectFirestore,
  projectGoogleAuth,
} from "./firebaseApp";

const signInWithEmail = (email: string, password: string) => signInWithEmailAndPassword(projectAuth, email, password);

const registerWithEmail = (email: string, password: string) => createUserWithEmailAndPassword(projectAuth, email, password);

const signInWithGoogle = () => signInWithPopup(projectAuth, projectGoogleAuth);

const signOutFromFirebase = () => signOut(projectAuth);

const onAuthStateChanged = (nextOrObserver: NextOrObserver<User>, error?: (error: unknown) => void, completed?: () => void) =>
  firebaseOnAuthStateChanged(projectAuth, nextOrObserver, error, completed);

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
