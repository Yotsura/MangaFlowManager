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

interface StageWorkloadEntry {
  granularityId: number;
  hours: number | null;
}

interface StageWorkload {
  id: number;
  label: string;
  entries: StageWorkloadEntry[];
}

interface StageWorkloadDocument {
  stages: StageWorkload[];
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
  stageWorkloads: StageWorkload[];
  stageWorkloadsLoaded: boolean;
  loadingStageWorkloads: boolean;
  savingStageWorkloads: boolean;
  stageWorkloadsLoadError: string | null;
  stageWorkloadsSaveError: string | null;
}

const buildDocumentPath = (userId: string) => `users/${userId}/settings/workHours`;
const buildGranularityPath = (userId: string) => `users/${userId}/settings/granularities`;
const buildStageWorkloadPath = (userId: string) => `users/${userId}/settings/stageWorkloads`;

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

const DEFAULT_STAGE_WORKLOADS: StageWorkload[] = [
  {
    id: 1,
    label: "ネーム",
    entries: [
      { granularityId: 1, hours: 3 },
      { granularityId: 2, hours: null },
    ],
  },
  {
    id: 2,
    label: "下書き",
    entries: [
      { granularityId: 1, hours: 1 },
      { granularityId: 2, hours: 0.5 },
    ],
  },
  {
    id: 3,
    label: "ペン入れ",
    entries: [
      { granularityId: 1, hours: null },
      { granularityId: 2, hours: 1 },
    ],
  },
  {
    id: 4,
    label: "仕上げ",
    entries: [
      { granularityId: 1, hours: null },
      { granularityId: 2, hours: 0.5 },
    ],
  },
];

const mapError = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  return "設定の保存処理で問題が発生しました。";
};

const cloneDefaults = () => DEFAULT_GRANULARITIES.map((item) => ({ ...item }));
const cloneDefaultStages = () => DEFAULT_STAGE_WORKLOADS.map((stage) => ({
  ...stage,
  entries: stage.entries.map((entry) => ({ ...entry })),
}));

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

const normalizeStageWorkloads = (items: unknown, granularities: Granularity[]): StageWorkload[] => {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const knownGranularityIds = new Set(granularities.map((g) => g.id));

  const normalized = items
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const rawStage = entry as Record<string, unknown>;
      const label = typeof rawStage.label === "string"
        ? rawStage.label
        : typeof rawStage.name === "string"
          ? rawStage.name
          : `ステージ${index + 1}`;

      const entriesRaw = Array.isArray(rawStage.entries) ? rawStage.entries : [];
      const entries: StageWorkloadEntry[] = entriesRaw
        .map((item) => {
          if (!item || typeof item !== "object") {
            return null;
          }
          const rawItem = item as Record<string, unknown>;
          const granularityId = Number(rawItem.granularityId ?? rawItem.id);
          if (!Number.isInteger(granularityId) || granularityId <= 0 || !knownGranularityIds.has(granularityId)) {
            return null;
          }
          const hoursValue = rawItem.hours;
          const hoursRaw =
            typeof hoursValue === "number"
              ? hoursValue
              : typeof hoursValue === "string"
                ? Number(hoursValue)
                : null;
          const normalizedHours =
            hoursRaw !== null && Number.isFinite(hoursRaw) && hoursRaw >= 0 ? Number(hoursRaw.toFixed(2)) : null;
          return {
            granularityId,
            hours: normalizedHours,
          } satisfies StageWorkloadEntry;
        })
        .filter((item): item is StageWorkloadEntry => item !== null);

      return {
        id: index + 1,
        label,
        entries,
      } satisfies StageWorkload;
    })
    .filter((item): item is StageWorkload => item !== null);

  return normalized.map((stage, index) => ({
    id: index + 1,
    label: stage.label,
    entries: stage.entries,
  }));
};

const alignStageEntries = (stages: StageWorkload[], granularities: Granularity[]): StageWorkload[] =>
  stages.map((stage, index) => ({
    id: index + 1,
    label: stage.label,
    entries: granularities.map((granularity) => {
      const existing = stage.entries.find((entry) => entry.granularityId === granularity.id);
      return {
        granularityId: granularity.id,
        hours: existing?.hours ?? null,
      } satisfies StageWorkloadEntry;
    }),
  }));

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
    stageWorkloads: [],
    stageWorkloadsLoaded: false,
    loadingStageWorkloads: false,
    savingStageWorkloads: false,
    stageWorkloadsLoadError: null,
    stageWorkloadsSaveError: null,
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
    async fetchStageWorkloads(userId: string) {
      if (!userId) {
        return;
      }

      this.loadingStageWorkloads = true;
      this.stageWorkloadsLoadError = null;

      try {
        if (!this.granularitiesLoaded && !this.loadingGranularities) {
          await this.fetchGranularities(userId);
        }

        const document = await getDocument<StageWorkloadDocument>(buildStageWorkloadPath(userId));
        const normalized = normalizeStageWorkloads(document?.stages, this.granularities);

        if (normalized.length > 0) {
          this.stageWorkloads = alignStageEntries(normalized, this.granularities);
        } else {
          const defaults = cloneDefaultStages();
          this.stageWorkloads = alignStageEntries(defaults, this.granularities);
        }

        this.stageWorkloadsLoaded = true;
      } catch (error) {
        this.stageWorkloadsLoadError = mapError(error);
        throw error;
      } finally {
        this.loadingStageWorkloads = false;
      }
    },
    async saveStageWorkloads(userId: string, stages: StageWorkload[]) {
      if (!userId) {
        throw new Error("ユーザー情報が取得できませんでした。");
      }

      this.savingStageWorkloads = true;
      this.stageWorkloadsSaveError = null;

      try {
        const sequencedStages = alignStageEntries(stages, this.granularities);

        await setDocument(buildStageWorkloadPath(userId), { stages: sequencedStages });
        this.stageWorkloads = sequencedStages;
        this.stageWorkloadsLoaded = true;
      } catch (error) {
        this.stageWorkloadsSaveError = mapError(error);
        throw error;
      } finally {
        this.savingStageWorkloads = false;
      }
    },
  },
});

export type { WorkHourRange, Granularity, StageWorkload, StageWorkloadEntry };
