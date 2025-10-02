import { FirebaseError } from "firebase/app";
import type { Persistence, User } from "firebase/auth";
import { defineStore } from "pinia";
import { computed, ref } from "vue";

import {
  applyAuthPersistence,
  authPersistence,
  onAuthStateChanged,
  projectAuth,
  registerWithEmail,
  signInWithEmail,
  signInWithGoogle,
  signOutFromFirebase,
} from "@/services/firebase/authService";

type AuthMode = "login" | "register";

const mapFirebaseError = (error: unknown): string => {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/invalid-email":
        return "メールアドレスの形式が正しくありません。";
      case "auth/user-disabled":
        return "このアカウントは無効化されています。";
      case "auth/user-not-found":
        return "ユーザーが見つかりません。新規登録が必要です。";
      case "auth/wrong-password":
        return "メールアドレスまたはパスワードが違います。";
      case "auth/weak-password":
        return "より強力なパスワードを設定してください。";
      case "auth/email-already-in-use":
        return "このメールアドレスは既に使用されています。";
      case "auth/popup-closed-by-user":
        return "ログイン処理が中断されました。";
      default:
        return "認証処理に失敗しました。時間を置いて再度お試しください。";
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "不明なエラーが発生しました。";
};

export const useAuthStore = defineStore("auth", () => {
  const user = ref<User | null>(null);
  const initializing = ref(true);
  const pending = ref(false);
  const lastError = ref<string | null>(null);
  const preferredMode = ref<AuthMode>("login");

  let unsubscribe: (() => void) | null = null;
  let initPromise: Promise<void> | null = null;

  const isAuthenticated = computed(() => user.value !== null);
  const displayName = computed(
    () => user.value?.displayName || user.value?.email || ""
  );

  const setMode = (mode: AuthMode) => {
    preferredMode.value = mode;
    lastError.value = null;
  };

  const ensureInitialized = async () => {
    if (!initPromise) {
      initPromise = new Promise<void>((resolve) => {
        unsubscribe = onAuthStateChanged(
          projectAuth,
          (currentUser) => {
            user.value = currentUser;
            initializing.value = false;
            resolve();
          },
          (error) => {
            lastError.value = mapFirebaseError(error);
            initializing.value = false;
            resolve();
          }
        );
      });
    }

    await initPromise;
  };

  const setPersistenceMode = async (
    persistence: Persistence = authPersistence.LOCAL
  ) => {
    await applyAuthPersistence(persistence);
  };

  const withPending = async <T>(operation: () => Promise<T>): Promise<T> => {
    pending.value = true;
    lastError.value = null;

    try {
      const result = await operation();
      return result;
    } catch (error) {
      lastError.value = mapFirebaseError(error);
      throw error;
    } finally {
      pending.value = false;
    }
  };

  const loginWithEmail = (email: string, password: string) =>
    withPending(() => signInWithEmail(email, password));

  const registerWithEmailAndPassword = (email: string, password: string) =>
    withPending(() => registerWithEmail(email, password));

  const loginWithGoogleProvider = () => withPending(() => signInWithGoogle());

  const logout = () => withPending(() => signOutFromFirebase());

  const clearError = () => {
    lastError.value = null;
  };

  const dispose = () => {
    unsubscribe?.();
    unsubscribe = null;
    initPromise = null;
  };

  return {
    user,
    initializing,
    pending,
    lastError,
    preferredMode,
    isAuthenticated,
    displayName,
    setMode,
    ensureInitialized,
    setPersistenceMode,
    loginWithEmail,
    registerWithEmailAndPassword,
    loginWithGoogleProvider,
    logout,
    clearError,
    dispose,
  };
});
