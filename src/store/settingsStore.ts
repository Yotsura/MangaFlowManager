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

interface Granularity {
  id: number;
  label: string;
  weight: number;
}

interface GranularitiesDocument {
  granularities: Granularity[];
}

interface SettingsState {
  workHours: WorkHourRange[];
  workHoursLoaded: boolean;
  loadingWorkHours: boolean;
  savingWorkHours: boolean;
  loadError: string | null;
  saveError: string | null;
  granularities: Granularity[];
  granularitiesLoaded: boolean;
  loadingGranularities: boolean;
  savingGranularities: boolean;
  granularitiesLoadError: string | null;
  granularitiesSaveError: string | null;
}

const buildDocumentPath = (userId: string) => `users/${userId}/settings/workHours`;
const buildGranularityPath = (userId: string) => `users/${userId}/settings/granularities`;

const DEFAULT_GRANULARITIES: Granularity[] = [
  {
    id: 1,
    label: "ページ単位",
    weight: 5,
  },
  {
    id: 2,
    label: "コマ単位",
    weight: 1,
  },
];

const mapError = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  return "設定の保存処理で問題が発生しました。";
};

const cloneDefaults = () => DEFAULT_GRANULARITIES.map((item) => ({ ...item }));

const normalizeGranularities = (items: unknown): Granularity[] => {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const normalized = items
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const raw = entry as Record<string, unknown>;
      const label = typeof raw.label === "string"
        ? raw.label
        : typeof raw.unit === "string"
          ? raw.unit
          : typeof raw.name === "string"
            ? raw.name
            : "";

      const weightValue = Number(raw.weight);
      const weight = Number.isFinite(weightValue) && weightValue > 0 ? Math.round(weightValue) : 1;

      return {
        id: index + 1,
        label,
        weight,
      } satisfies Granularity;
    })
    .filter((item): item is Granularity => item !== null);

  return normalized.map((item, index) => ({
    id: index + 1,
    label: item.label,
    weight: item.weight,
  }));
};

export const useSettingsStore = defineStore("settings", {
  state: (): SettingsState => ({
    workHours: [],
    workHoursLoaded: false,
    loadingWorkHours: false,
    savingWorkHours: false,
    loadError: null,
    saveError: null,
    granularities: [],
    granularitiesLoaded: false,
    loadingGranularities: false,
    savingGranularities: false,
    granularitiesLoadError: null,
    granularitiesSaveError: null,
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
    setGranularities(items: Granularity[]) {
      this.granularities = items;
    },
    async fetchGranularities(userId: string) {
      if (!userId) {
        return;
      }

      this.loadingGranularities = true;
      this.granularitiesLoadError = null;

      try {
        const document = await getDocument<GranularitiesDocument>(buildGranularityPath(userId));
        const normalized = normalizeGranularities(document?.granularities);

        if (normalized.length > 0) {
          this.granularities = normalized;
        } else {
          const defaults = cloneDefaults();
          this.granularities = defaults;
        }

        this.granularitiesLoaded = true;
      } catch (error) {
        this.granularitiesLoadError = mapError(error);
        throw error;
      } finally {
        this.loadingGranularities = false;
      }
    },
    async saveGranularities(userId: string, items: Granularity[]) {
      if (!userId) {
        throw new Error("ユーザー情報が取得できませんでした。");
      }

      this.savingGranularities = true;
      this.granularitiesSaveError = null;

      try {
        const sequencedItems = items.map((item, index) => ({
          id: index + 1,
          label: item.label,
          weight: item.weight,
        }));

        await setDocument(buildGranularityPath(userId), { granularities: sequencedItems });
        this.granularities = sequencedItems;
        this.granularitiesLoaded = true;
      } catch (error) {
        this.granularitiesSaveError = mapError(error);
        throw error;
      } finally {
        this.savingGranularities = false;
      }
    },
  },
});

export type { WorkHourRange, Granularity };
