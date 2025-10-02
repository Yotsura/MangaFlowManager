import { defineStore } from "pinia";

import { getDocument, setDocument } from "@/services/firebase/firestoreService";

interface WorkHourRange {
  day: string;
  start: string;
  end: string;
}

interface WorkHoursDocument {
  workHours: WorkHourRange[];
}

interface SettingsState {
  workHours: WorkHourRange[];
  workHoursLoaded: boolean;
  loadingWorkHours: boolean;
  savingWorkHours: boolean;
  loadError: string | null;
  saveError: string | null;
}

const buildDocumentPath = (userId: string) => `users/${userId}/settings/workHours`;

const mapError = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  return "設定の保存処理で問題が発生しました。";
};

export const useSettingsStore = defineStore("settings", {
  state: (): SettingsState => ({
    workHours: [],
    workHoursLoaded: false,
    loadingWorkHours: false,
    savingWorkHours: false,
    loadError: null,
    saveError: null,
  }),
  actions: {
    setWorkHours(hours: WorkHourRange[]) {
      this.workHours = hours;
    },
    async fetchWorkHours(userId: string) {
      if (!userId) {
        return;
      }

      this.loadingWorkHours = true;
      this.loadError = null;

      try {
        const document = await getDocument<WorkHoursDocument>(buildDocumentPath(userId));
        this.workHours = document?.workHours ?? [];
        this.workHoursLoaded = true;
      } catch (error) {
        this.loadError = mapError(error);
        throw error;
      } finally {
        this.loadingWorkHours = false;
      }
    },
    async saveWorkHours(userId: string, hours: WorkHourRange[]) {
      if (!userId) {
        throw new Error("ユーザー情報が取得できませんでした。");
      }

      this.savingWorkHours = true;
      this.saveError = null;

      try {
        await setDocument(buildDocumentPath(userId), { workHours: hours }, { merge: true });
        this.workHours = hours;
        this.workHoursLoaded = true;
      } catch (error) {
        this.saveError = mapError(error);
        throw error;
      } finally {
        this.savingWorkHours = false;
      }
    },
  },
});

export type { WorkHourRange };
