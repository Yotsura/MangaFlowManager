import { defineStore } from "pinia";
import { deleteDocument, getCollectionDocs, setDocument } from "@/services/firebase/firestoreService";

export type CustomDateType = "custom-holiday" | "unavailable" | "custom-hours";

export interface CustomDate {
  id: string; // YYYY-MM-DD形式
  date: string; // YYYY-MM-DD形式
  type: CustomDateType;
  customHours?: number; // custom-hoursタイプの場合の固有作業時間
  createdAt: string;
  updatedAt: string;
}

type CustomDateDocument = Omit<CustomDate, "id">;

interface CustomDatesState {
  customDates: CustomDate[];
  customDatesLoaded: boolean;
  loadingCustomDates: boolean;
  savingCustomDates: boolean;
  loadError: string | null;
  saveError: string | null;
}

const buildCollectionPath = (userId: string) => `users/${userId}/customDates`;
const buildDocumentPath = (userId: string, dateId: string) => `${buildCollectionPath(userId)}/${dateId}`;

export const useCustomDatesStore = defineStore("customDates", {
  state: (): CustomDatesState => ({
    customDates: [],
    customDatesLoaded: false,
    loadingCustomDates: false,
    savingCustomDates: false,
    loadError: null,
    saveError: null,
  }),

  getters: {
    getCustomDateByDate: (state) => (date: string) => {
      return state.customDates.find((cd) => cd.date === date);
    },

    getCustomDatesForMonth: (state) => (year: number, month: number) => {
      const monthStr = `${year}-${String(month).padStart(2, "0")}`;
      return state.customDates.filter((cd) => cd.date.startsWith(monthStr));
    },
  },

  actions: {
    async fetchCustomDates(userId: string) {
      if (this.loadingCustomDates) {
        return;
      }

      this.loadingCustomDates = true;
      this.loadError = null;

      try {
        const path = buildCollectionPath(userId);
        const docs = await getCollectionDocs<CustomDateDocument>(path);

        this.customDates = docs.map((doc) => ({
          ...doc,
          id: doc.id,
        })) as CustomDate[];

        this.customDatesLoaded = true;
      } catch (error) {
        console.error("Failed to fetch custom dates:", error);
        this.loadError = error instanceof Error ? error.message : "カスタム日付の読み込みに失敗しました。";
      } finally {
        this.loadingCustomDates = false;
      }
    },

    async setCustomDate(userId: string, date: string, type: CustomDateType, customHours?: number) {
      this.savingCustomDates = true;
      this.saveError = null;

      try {
        const dateId = date; // YYYY-MM-DD形式をIDとして使用
        const now = new Date().toISOString();

        const existing = this.customDates.find((cd) => cd.date === date);
        const document: CustomDateDocument = {
          date,
          type,
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        };

        // custom-hoursタイプの場合のみcustomHoursを含める
        if (type === "custom-hours" && customHours !== undefined) {
          document.customHours = customHours;
        }

        const path = buildDocumentPath(userId, dateId);
        await setDocument(path, document);

        // ローカル状態を更新
        const index = this.customDates.findIndex((cd) => cd.date === date);
        if (index >= 0) {
          this.customDates[index] = { id: dateId, ...document };
        } else {
          this.customDates.push({ id: dateId, ...document });
        }
      } catch (error) {
        console.error("Failed to set custom date:", error);
        this.saveError = error instanceof Error ? error.message : "カスタム日付の保存に失敗しました。";
        throw error;
      } finally {
        this.savingCustomDates = false;
      }
    },

    async removeCustomDate(userId: string, date: string) {
      this.savingCustomDates = true;
      this.saveError = null;

      try {
        const dateId = date;
        const path = buildDocumentPath(userId, dateId);
        await deleteDocument(path);

        // ローカル状態を更新
        const index = this.customDates.findIndex((cd) => cd.date === date);
        if (index >= 0) {
          this.customDates.splice(index, 1);
        }
      } catch (error) {
        console.error("Failed to remove custom date:", error);
        this.saveError = error instanceof Error ? error.message : "カスタム日付の削除に失敗しました。";
        throw error;
      } finally {
        this.savingCustomDates = false;
      }
    },
  },
});
