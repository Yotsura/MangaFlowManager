import { defineStore } from "pinia";

import { getDefaultStageColor, normalizeStageColorValue } from "@/modules/works/utils/stageColor";
import { getDocument, setDocument } from "@/services/firebase/firestoreService";
import { generateId } from "@/utils/id";

interface WorkHourRange {
  day: string;
  hours: number;
}

interface WorkHoursDocument {
  workHours: WorkHourRange[];
}

interface Granularity {
  id: string;
  label: string;
  weight: number;
  defaultCount: number; // デフォルト配置数
}

interface GranularitiesDocument {
  granularities: Granularity[];
}

interface StageWorkloadEntry {
  granularityId: string;
  hours: number | null;
}

interface StageWorkload {
  id: number;
  label: string;
  color: string;
  baseHours: number | null; // 最低粒度での工数のみ保持
}

interface StageWorkloadCandidate {
  id: number;
  label: string;
  color: string | null;
  baseHours: number | null;
  entries: StageWorkloadEntry[];
}

interface StageWorkloadDocumentStage {
  id?: number;
  label?: string;
  color?: string;
  entries?: unknown;
}

interface StageWorkloadDocument {
  stages: StageWorkloadDocumentStage[];
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
  granularityIdMigrationMap: Record<string, string>;
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

type GranularityIdMigrationMap = Record<string, string>;

interface GranularityTemplate {
  label: string;
  weight: number;
  defaultCount: number;
}

interface StageTemplateEntry {
  granularityIndex: number;
  hours: number | null;
}

interface StageTemplate {
  label: string;
  entries: StageTemplateEntry[];
}

const DEFAULT_GRANULARITY_TEMPLATES: GranularityTemplate[] = [
  {
    label: "ページ単位",
    weight: 5,
    defaultCount: 10, // デフォルト10ページ
  },
  {
    label: "コマ単位",
    weight: 1,
    defaultCount: 4, // ページあたりデフォルト4コマ
  },
];

const DEFAULT_STAGE_TEMPLATES: StageTemplate[] = [
  {
    label: "ネーム",
    entries: [
      { granularityIndex: 0, hours: 3 },
      { granularityIndex: 1, hours: null },
    ],
  },
  {
    label: "下書き",
    entries: [
      { granularityIndex: 0, hours: 1 },
      { granularityIndex: 1, hours: 0.5 },
    ],
  },
  {
    label: "ペン入れ",
    entries: [
      { granularityIndex: 0, hours: null },
      { granularityIndex: 1, hours: 1 },
    ],
  },
  {
    label: "仕上げ",
    entries: [
      { granularityIndex: 0, hours: null },
      { granularityIndex: 1, hours: 0.5 },
    ],
  },
];

const mapError = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  return "設定の保存処理で問題が発生しました。";
};

const createDefaultGranularities = (): Granularity[] =>
  DEFAULT_GRANULARITY_TEMPLATES.map((template) => ({
    id: generateId(),
    label: template.label,
    weight: template.weight,
    defaultCount: template.defaultCount,
  }));

// 粒度の比重を使って最低粒度の工数を計算
const calculateBaseHours = (entries: StageWorkloadEntry[], granularities: Granularity[]): number | null => {
  if (!granularities.length) return null;

  // 最低粒度（最も比重の小さい粒度）を取得
  const lowestGranularity = granularities.reduce((min, current) =>
    current.weight < min.weight ? current : min
  );

  // 最低粒度に直接設定されている場合
  const directEntry = entries.find(e => e.granularityId === lowestGranularity.id);
  if (directEntry && directEntry.hours !== null) {
    return directEntry.hours;
  }

  // より上位の粒度から計算
  for (const entry of entries) {
    if (entry.hours === null) continue;

    const granularity = granularities.find(g => g.id === entry.granularityId);
    if (!granularity) continue;

    // 比重の比率で最低粒度の工数を計算
    const ratio = lowestGranularity.weight / granularity.weight;
    return entry.hours * ratio;
  }

  return null;
};

const createDefaultStageWorkloads = (granularities: Granularity[]): StageWorkload[] => {
  const totalStages = DEFAULT_STAGE_TEMPLATES.length;

  return DEFAULT_STAGE_TEMPLATES.map((template, stageIndex) => {
    // テンプレートから一時的なentriesを作成して baseHours を計算
    const tempEntries = template.entries
      .map((entry) => {
        const target = granularities[entry.granularityIndex];
        if (!target) {
          return null;
        }
        return {
          granularityId: target.id,
          hours: entry.hours,
        } satisfies StageWorkloadEntry;
      })
      .filter((item): item is StageWorkloadEntry => item !== null);

    const baseHours = calculateBaseHours(tempEntries, granularities);

    return {
      id: stageIndex + 1,
      label: template.label,
      color: getDefaultStageColor(stageIndex, totalStages),
      baseHours,
    };
  });
};

interface NormalizedGranularitiesResult {
  items: Granularity[];
  migrationMap: GranularityIdMigrationMap;
}

const normalizeGranularities = (items: unknown): NormalizedGranularitiesResult => {
  if (!Array.isArray(items) || items.length === 0) {
    return { items: [], migrationMap: {} };
  }

  const usedIds = new Set<string>();
  const migrationMap: GranularityIdMigrationMap = {};

  const normalized = items
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const raw = entry as Record<string, unknown>;

      const label = typeof raw.label === "string" ? raw.label : typeof raw.unit === "string" ? raw.unit : typeof raw.name === "string" ? raw.name : "";

      const weightValue = Number(raw.weight);
      const weight = Number.isFinite(weightValue) && weightValue > 0 ? Math.round(weightValue) : 1;

      const rawIdValue = raw.id ?? raw.key ?? raw.uuid ?? raw.identifier;
      let originalId: string | null = null;

      if (typeof rawIdValue === "string") {
        originalId = rawIdValue.trim();
      } else if (typeof rawIdValue === "number") {
        originalId = String(rawIdValue);
      }

      if (!originalId || originalId.length === 0) {
        originalId = String(index + 1);
      }

      const isLegacyId = /^\d+$/.test(originalId);

      let assignedId = originalId;

      if (isLegacyId || usedIds.has(assignedId)) {
        assignedId = generateId();
        if (originalId) {
          migrationMap[originalId] = assignedId;
        }
      }

      if (usedIds.has(assignedId)) {
        const fallback = generateId();
        migrationMap[originalId] = fallback;
        assignedId = fallback;
      }

      usedIds.add(assignedId);

      return {
        id: assignedId,
        label,
        weight,
        defaultCount: typeof raw.defaultCount === 'number' ? raw.defaultCount : 1,
      } satisfies Granularity;
    })
    .filter((item): item is Granularity => item !== null);

  return { items: normalized, migrationMap };
};

const normalizeStageWorkloads = (items: unknown, granularities: Granularity[], migrationMap: GranularityIdMigrationMap): StageWorkload[] => {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const knownGranularityIds = new Set(granularities.map((g) => g.id));
  const fallbackIndexMap = new Map<number, string>();
  granularities.forEach((granularity, index) => {
    fallbackIndexMap.set(index + 1, granularity.id);
  });

  const normalized = items
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const rawStage = entry as Record<string, unknown>;
      const label = typeof rawStage.label === "string" ? rawStage.label : typeof rawStage.name === "string" ? rawStage.name : `ステージ${index + 1}`;

      const rawStageId = rawStage.id;
      const stageId = Number.isFinite(rawStageId) ? Number(rawStageId) : index + 1;

      const colorValue = typeof rawStage.color === "string" ? rawStage.color : null;

      // 既にbaseHoursが存在する場合はそれを使用
      const existingBaseHours = typeof rawStage.baseHours === "number" ? rawStage.baseHours : null;

      const entriesRaw = Array.isArray(rawStage.entries) ? rawStage.entries : [];
      const entries: StageWorkloadEntry[] = entriesRaw
        .map((item) => {
          if (!item || typeof item !== "object") {
            return null;
          }

          const rawItem = item as Record<string, unknown>;
          const rawGranularityId = rawItem.granularityId ?? rawItem.id;

          let normalizedGranularityId: string | null = null;

          if (typeof rawGranularityId === "string") {
            const trimmed = rawGranularityId.trim();
            normalizedGranularityId = migrationMap[trimmed] ?? trimmed;
          } else if (typeof rawGranularityId === "number") {
            const key = String(rawGranularityId);
            normalizedGranularityId = migrationMap[key] ?? fallbackIndexMap.get(rawGranularityId) ?? key;
          }

          if (!normalizedGranularityId || !knownGranularityIds.has(normalizedGranularityId)) {
            return null;
          }

          const hoursValue = rawItem.hours;
          const hoursRaw = typeof hoursValue === "number" ? hoursValue : typeof hoursValue === "string" ? Number(hoursValue) : null;
          const normalizedHours = hoursRaw !== null && Number.isFinite(hoursRaw) && hoursRaw >= 0 ? Number(hoursRaw.toFixed(2)) : null;

          return {
            granularityId: normalizedGranularityId,
            hours: normalizedHours,
          } satisfies StageWorkloadEntry;
        })
        .filter((item): item is StageWorkloadEntry => item !== null);

      return {
        id: stageId,
        label,
        color: colorValue,
        baseHours: existingBaseHours,
        entries,
      } as StageWorkloadCandidate;
    })
    .filter((item): item is StageWorkloadCandidate => item !== null);

  const totalStages = normalized.length;

  return normalized.map((stage, index) => {
    // 既にbaseHoursが存在する場合はそれを使用、なければentriesから計算
    const baseHours = stage.baseHours !== null ? stage.baseHours : calculateBaseHours(stage.entries, granularities);
    console.log(`Stage "${stage.label}": existing baseHours=`, stage.baseHours, "entries=", stage.entries, "final baseHours=", baseHours);
    return {
      id: index + 1,
      label: stage.label,
      color: normalizeStageColorValue(stage.color, index, totalStages),
      baseHours,
    };
  });
};

const alignStageEntries = (stages: StageWorkload[]): StageWorkload[] => {
  const totalStages = stages.length;

  return stages.map((stage, index) => ({
    id: index + 1,
    label: stage.label,
    color: normalizeStageColorValue(stage.color, index, totalStages),
    baseHours: stage.baseHours, // baseHoursはそのまま保持
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
    granularityIdMigrationMap: {},
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
        const { items, migrationMap } = normalizeGranularities(document?.granularities);

        if (items.length > 0) {
          this.granularities = items;
          this.granularityIdMigrationMap = migrationMap;
        } else {
          const defaults = createDefaultGranularities();
          this.granularities = defaults;
          this.granularityIdMigrationMap = {};
        }

        if (this.stageWorkloadsLoaded) {
          this.stageWorkloads = alignStageEntries(this.stageWorkloads);
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
        const normalizedItems = items.map((item) => {
          const trimmedLabel = item.label.trim();
          const id = typeof item.id === "string" && item.id.trim().length > 0 ? item.id.trim() : generateId();

          return {
            id,
            label: trimmedLabel,
            weight: item.weight,
            defaultCount: item.defaultCount,
          } satisfies Granularity;
        });

        await setDocument(buildGranularityPath(userId), { granularities: normalizedItems });
        this.granularities = normalizedItems;
        this.granularitiesLoaded = true;
        this.granularityIdMigrationMap = {};

        if (this.stageWorkloadsLoaded) {
          this.stageWorkloads = alignStageEntries(this.stageWorkloads);
        }
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
        const normalized = normalizeStageWorkloads(document?.stages, this.granularities, this.granularityIdMigrationMap);

        if (normalized.length > 0) {
          this.stageWorkloads = alignStageEntries(normalized);
        } else {
          const defaults = createDefaultStageWorkloads(this.granularities);
          this.stageWorkloads = alignStageEntries(defaults);
        }

        this.stageWorkloadsLoaded = true;
        this.granularityIdMigrationMap = {};
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
        const sequencedStages = alignStageEntries(stages);

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
