import { defineStore } from "pinia";

import { deleteDocument, getCollectionDocs, getDocument, setDocument } from "@/services/firebase/firestoreService";
import { generateId } from "@/utils/id";
import type { Granularity, StageWorkload } from "@/store/settingsStore";

export const WORK_STATUSES = ["未着手", "作業中", "完了", "保留"] as const;
export type WorkStatus = (typeof WORK_STATUSES)[number];

export interface WorkUnit {
  id: string;
  index: number;
  children?: WorkUnit[]; // 最下位以外は持つ
  stageIndex?: number; // 最下位のみ持つ
}

// 作品固有の粒度設定
export interface WorkGranularity {
  id: string;
  label: string;
  weight: number;
  defaultCount: number;
}

// 作品固有の段階工数設定
export interface WorkStageWorkloadEntry {
  granularityId: string;
  hours: number | null;
}

export interface WorkStageWorkload {
  id: number;
  label: string;
  color: string;
  baseHours: number | null; // 最低粒度での工数のみ保持
  entries?: WorkStageWorkloadEntry[]; // 後方互換性のため（古いデータ用）
}

export interface Work {
  id: string;
  title: string;
  status: WorkStatus;
  startDate: string;
  deadline: string;
  createdAt: string;
  updatedAt: string;
  totalUnits: number;
  defaultCounts: number[]; // 各粒度レベルのデフォルト数 [上位→下位]
  primaryGranularityId: string | null;
  unitEstimatedHours: number;
  totalEstimatedHours: number;
  units: WorkUnit[]; // 最上位粒度の配列

  // 作品固有の設定
  workGranularities?: WorkGranularity[]; // 作品作成時点の粒度設定
  workStageWorkloads?: WorkStageWorkload[]; // 作品作成時点の段階工数設定
}

type WorkDocument = Omit<Work, "id">;

interface WorksState {
  works: Work[];
  worksLoaded: boolean;
  loadingWorks: boolean;
  loadError: string | null;
  savingWorkMap: Record<string, boolean>;
  saveErrorMap: Record<string, string>;
  dirtyWorkMap: Record<string, boolean>;
}

interface CreateWorkPayload {
  title: string;
  status: WorkStatus;
  startDate: string;
  deadline: string;
  totalUnits: number;
  defaultCounts: number[]; // 各階層のデフォルト数 [上位→下位]
  primaryGranularityId: string | null;
  unitEstimatedHours: number;

  // 作品作成時点の設定をコピー
  workGranularities: WorkGranularity[];
  workStageWorkloads: WorkStageWorkload[];
}

interface RemoveWorkPayload {
  userId: string;
  workId: string;
}

interface SaveWorkPayload {
  userId: string;
  workId: string;
}

const mapError = (error: unknown, fallback: string) => {
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
};

const buildWorkCollectionPath = (userId: string) => `users/${userId}/works`;
const buildWorkDocumentPath = (userId: string, workId: string) => `${buildWorkCollectionPath(userId)}/${workId}`;

const normalizePositiveInteger = (value: number, fallback: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
};

const recalculateUnitIndices = (units: WorkUnit[]) => {
  units.forEach((unit, index) => {
    unit.index = index + 1;
    if (unit.children) {
      recalculateUnitIndices(unit.children);
    }
  });
};

const findUnitInHierarchy = (units: WorkUnit[], unitId: string): WorkUnit | null => {
  for (const unit of units) {
    if (unit.id === unitId) {
      return unit;
    }
    if (unit.children) {
      const found = findUnitInHierarchy(unit.children, unitId);
      if (found) {
        return found;
      }
    }
  }
  return null;
};

const normalizeUnit = (raw: unknown, fallbackIndex: number, isLeafLevel?: boolean): WorkUnit | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const data = raw as Record<string, unknown>;

  const id = typeof data.id === "string" && data.id.trim().length > 0 ? data.id : generateId();
  const indexRaw = Number(data.index);
  const index = Number.isFinite(indexRaw) && indexRaw > 0 ? Math.floor(indexRaw) : fallbackIndex;

  // stageIndexの有無で最下位粒度かどうかを自動判定
  const hasStageIndex = data.stageIndex !== undefined && data.stageIndex !== null;
  const hasChildren = Array.isArray(data.children) && data.children.length > 0;

  // isLeafLevelが明示的に指定されていない場合は自動判定
  const actualIsLeaf = isLeafLevel !== undefined ? isLeafLevel : hasStageIndex && !hasChildren;

  if (actualIsLeaf || hasStageIndex) {
    // 最下位粒度: stageIndexを持つ
    const stageRaw = Number(data.stageIndex);
    const stageIndex = Number.isFinite(stageRaw) && stageRaw >= 0 ? Math.floor(stageRaw) : 0;

    return {
      id,
      index,
      stageIndex,
    } satisfies WorkUnit;
  } else {
    // 中間粒度: childrenを持つ
    let children: WorkUnit[] = [];

    if (Array.isArray(data.children)) {
      children = data.children
        .map((childRaw, childIndex) => normalizeUnit(childRaw, childIndex + 1))
        .filter((child): child is WorkUnit => child !== null)
        .map((child, childIndex) => ({ ...child, index: childIndex + 1 }));
    }

    return {
      id,
      index,
      children,
    } satisfies WorkUnit;
  }
};
const mapDocumentToWork = (item: WorkDocument & { id: string }): Work => {
  const createdAt = typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString();
  const updatedAt = typeof item.updatedAt === "string" ? item.updatedAt : createdAt;

  // 新形式のunitsまたは旧形式のpagesを処理
  let units: WorkUnit[] = [];
  let defaultCounts: number[] = [];

  if (Array.isArray((item as any).units)) {
    // 新形式: unitsプロパティがある場合
    units = (item as any).units
      .map((unitRaw: unknown, index: number) => normalizeUnit(unitRaw, index + 1))
      .filter((unit: WorkUnit | null): unit is WorkUnit => unit !== null)
      .map((unit: WorkUnit, index: number) => ({ ...unit, index: index + 1 }));

    defaultCounts = Array.isArray((item as any).defaultCounts) ? (item as any).defaultCounts : [1];
  } else if (Array.isArray((item as any).pages)) {
    // 旧形式からの移行: pagesをunitsに変換
    const pagesRaw = (item as any).pages;
    units = pagesRaw
      .map((pageRaw: any, index: number) => {
        // 旧形式のpageをunit構造に変換
        return normalizeUnit(
          {
            id: pageRaw.id || generateId(),
            index: index + 1,
            children: Array.isArray(pageRaw.panels)
              ? pageRaw.panels.map((panel: any, panelIndex: number) => ({
                  id: panel.id || generateId(),
                  index: panelIndex + 1,
                  stageIndex: panel.stageIndex || 0,
                }))
              : Array.from({ length: pageRaw.panelCount || 1 }, (_, panelIndex) => ({
                  id: generateId(),
                  index: panelIndex + 1,
                  stageIndex: pageRaw.stageIndex || 0,
                })),
          },
          index + 1,
          false,
        );
      })
      .filter((unit: WorkUnit | null): unit is WorkUnit => unit !== null);

    const defaultPanels = Number.isFinite(Number((item as any).defaultPanelsPerPage)) && Number((item as any).defaultPanelsPerPage) > 0 ? Math.floor(Number((item as any).defaultPanelsPerPage)) : 1;
    defaultCounts = [defaultPanels];
  }

  const totalUnits = Number.isFinite(Number(item.totalUnits)) && Number(item.totalUnits) > 0 ? Math.floor(Number(item.totalUnits)) : units.length;
  const unitEstimatedHours = Number.isFinite(Number(item.unitEstimatedHours)) && Number(item.unitEstimatedHours) >= 0 ? Number(item.unitEstimatedHours) : 0;
  const totalEstimatedHours =
    Number.isFinite(Number(item.totalEstimatedHours)) && Number(item.totalEstimatedHours) >= 0 ? Number(item.totalEstimatedHours) : Number((totalUnits * unitEstimatedHours).toFixed(2));

  return {
    id: item.id,
    title: typeof item.title === "string" ? item.title : "",
    status: WORK_STATUSES.includes(item.status as WorkStatus) ? (item.status as WorkStatus) : WORK_STATUSES[0],
    startDate: typeof item.startDate === "string" ? item.startDate : "",
    deadline: typeof item.deadline === "string" ? item.deadline : "",
    createdAt,
    updatedAt,
    totalUnits,
    defaultCounts,
    primaryGranularityId: typeof item.primaryGranularityId === "string" ? item.primaryGranularityId : null,
    unitEstimatedHours,
    totalEstimatedHours,
    units,
    workGranularities: Array.isArray(item.workGranularities) ? item.workGranularities : [],
    workStageWorkloads: Array.isArray(item.workStageWorkloads) ? item.workStageWorkloads : [],
  };
};

const serializeWorkUnit = (unit: WorkUnit): any => {
  const result: any = {
    id: unit.id,
    index: unit.index,
  };

  if (unit.stageIndex !== undefined) {
    // 最下位粒度
    result.stageIndex = unit.stageIndex;
  } else if (unit.children) {
    // 中間粒度
    result.children = unit.children.map(serializeWorkUnit);
  }

  return result;
};

const serializeWork = (work: Work): WorkDocument => ({
  title: work.title,
  status: work.status,
  startDate: work.startDate,
  deadline: work.deadline,
  createdAt: work.createdAt,
  updatedAt: work.updatedAt,
  totalUnits: work.totalUnits,
  defaultCounts: work.defaultCounts,
  primaryGranularityId: work.primaryGranularityId,
  unitEstimatedHours: work.unitEstimatedHours,
  totalEstimatedHours: work.totalEstimatedHours,
  units: work.units.map(serializeWorkUnit),
  workGranularities: work.workGranularities || [],
  workStageWorkloads: work.workStageWorkloads || [],
});

export const useWorksStore = defineStore("works", {
  state: (): WorksState => ({
    works: [],
    worksLoaded: false,
    loadingWorks: false,
    loadError: null,
    savingWorkMap: {},
    saveErrorMap: {},
    dirtyWorkMap: {},
  }),
  getters: {
    getWorkById: (state) => (id: string) => state.works.find((work) => work.id === id),
    isWorkDirty: (state) => (id: string) => !!state.dirtyWorkMap[id],
    isSavingWork: (state) => (id: string) => !!state.savingWorkMap[id],
    getSaveError: (state) => (id: string) => state.saveErrorMap[id] ?? null,
  },
  actions: {
    markWorkDirty(workId: string) {
      this.dirtyWorkMap = { ...this.dirtyWorkMap, [workId]: true };
    },
    clearWorkDirty(workId: string) {
      if (!this.dirtyWorkMap[workId]) {
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [workId]: _, ...rest } = this.dirtyWorkMap;
      this.dirtyWorkMap = rest;
    },
    setSaving(workId: string, value: boolean) {
      if (value) {
        this.savingWorkMap = { ...this.savingWorkMap, [workId]: true };
      } else if (this.savingWorkMap[workId]) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [workId]: _, ...rest } = this.savingWorkMap;
        this.savingWorkMap = rest;
      }
    },
    setSaveError(workId: string, message: string | null) {
      if (message === null) {
        if (this.saveErrorMap[workId] !== undefined) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [workId]: _, ...rest } = this.saveErrorMap;
          this.saveErrorMap = rest;
        }
      } else {
        this.saveErrorMap = { ...this.saveErrorMap, [workId]: message };
      }
    },
    setWorks(works: Work[]) {
      this.works = works;
    },
    async fetchWorks(userId: string) {
      if (!userId) {
        return;
      }

      this.loadingWorks = true;
      this.loadError = null;

      try {
        const documents = await getCollectionDocs<WorkDocument>(buildWorkCollectionPath(userId));
        const normalized = documents.map((doc) => mapDocumentToWork(doc));
        this.setWorks(normalized);
        this.worksLoaded = true;
        this.dirtyWorkMap = {};
        this.saveErrorMap = {};
        this.savingWorkMap = {};
      } catch (error) {
        this.loadError = mapError(error, "作品の読み込みに失敗しました。");
        throw error;
      } finally {
        this.loadingWorks = false;
      }
    },
    async fetchWorkById(userId: string, workId: string) {
      if (!userId || !workId) {
        return;
      }

      try {
        this.loadingWorks = true;
        const document = await getDocument<WorkDocument>(buildWorkDocumentPath(userId, workId));

        if (document) {
          const normalizedWork = mapDocumentToWork({ ...document, id: workId });

          // 既存の作品データを更新
          const index = this.works.findIndex((work) => work.id === workId);
          if (index !== -1) {
            this.works[index] = normalizedWork;
          } else {
            this.works.push(normalizedWork);
          }

          // dirty状態をクリア
          this.clearWorkDirty(workId);
        }
      } catch (error) {
        console.error("Failed to fetch work:", error);
        throw error;
      } finally {
        this.loadingWorks = false;
      }
    },
    discardWorkChanges(workId: string) {
      // dirty状態をクリア
      this.clearWorkDirty(workId);
    },
    createWork(payload: CreateWorkPayload): Work {
      const now = new Date().toISOString();
      const totalUnits = normalizePositiveInteger(payload.totalUnits, 1);
      const defaultCounts = payload.defaultCounts.length > 0 ? payload.defaultCounts : [1];

      // 階層構造を動的に作成
      const createHierarchy = (counts: number[], depth: number = 0): WorkUnit[] => {
        if (counts.length === 0) {
          // 最下位レベル：stageIndexを持つ
          return [];
        }

        const currentCount = normalizePositiveInteger(counts[0] ?? 1, 1);
        const remainingCounts = counts.slice(1);

        return Array.from({ length: currentCount }, (_, index) => {
          const unit: WorkUnit = {
            id: generateId(),
            index: index + 1,
          };

          if (remainingCounts.length > 0) {
            // 中間レベル：子要素を持つ
            unit.children = createHierarchy(remainingCounts, depth + 1);
          } else {
            // 最下位レベル：stageIndexを持つ
            unit.stageIndex = 0;
          }

          return unit;
        });
      };

      const units = createHierarchy([totalUnits, ...defaultCounts]);

      const unitEstimatedHours = Math.max(0, payload.unitEstimatedHours);
      const work: Work = {
        id: generateId(),
        title: payload.title.trim(),
        status: payload.status,
        startDate: payload.startDate,
        deadline: payload.deadline,
        createdAt: now,
        updatedAt: now,
        totalUnits,
        defaultCounts, // 各階層のデフォルト数
        primaryGranularityId: payload.primaryGranularityId,
        unitEstimatedHours,
        totalEstimatedHours: Number((totalUnits * unitEstimatedHours).toFixed(2)),
        units,

        // 作品固有の設定をコピー
        workGranularities: payload.workGranularities,
        workStageWorkloads: payload.workStageWorkloads,
      };

      this.works.push(work);
      this.worksLoaded = true;
      this.markWorkDirty(work.id);
      this.setSaveError(work.id, null);
      return work;
    },
    updateWork(id: string, patch: Partial<Pick<Work, "title" | "status" | "startDate" | "deadline" | "unitEstimatedHours" | "workGranularities" | "workStageWorkloads">>) {
      const target = this.works.find((work) => work.id === id);
      if (!target) {
        return;
      }

      let shouldRecalculateTotals = false;

      if (patch.title !== undefined) {
        target.title = patch.title.trim();
      }
      if (patch.status !== undefined) {
        target.status = patch.status;
      }
      if (patch.startDate !== undefined) {
        target.startDate = patch.startDate;
      }
      if (patch.deadline !== undefined) {
        target.deadline = patch.deadline;
      }

      if (patch.unitEstimatedHours !== undefined) {
        target.unitEstimatedHours = Math.max(0, patch.unitEstimatedHours);
        shouldRecalculateTotals = true;
      }

      if (patch.workGranularities !== undefined) {
        target.workGranularities = patch.workGranularities;
      }

      if (patch.workStageWorkloads !== undefined) {
        target.workStageWorkloads = patch.workStageWorkloads;
      }

      if (shouldRecalculateTotals) {
        target.totalEstimatedHours = Number((target.totalUnits * target.unitEstimatedHours).toFixed(2));
      }

      target.updatedAt = new Date().toISOString();
      this.markWorkDirty(target.id);
    },
    recalculateTotals(workId: string) {
      const target = this.works.find((work) => work.id === workId);
      if (!target) {
        return;
      }

      const countUnits = (units: WorkUnit[]): number => {
        return units.reduce((acc, unit) => {
          if (unit.children && unit.children.length > 0) {
            return acc + countUnits(unit.children);
          }
          return acc + 1;
        }, 0);
      };

      target.totalUnits = countUnits(target.units);
      target.totalEstimatedHours = Number((target.totalUnits * target.unitEstimatedHours).toFixed(2));
      target.updatedAt = new Date().toISOString();
      this.markWorkDirty(target.id);
    },
    advanceUnitStage(workId: string, unitId: string, stageCount: number) {
      const target = this.works.find((work) => work.id === workId);
      if (!target) {
        return;
      }

      const unit = findUnitInHierarchy(target.units, unitId);
      if (!unit || unit.stageIndex === undefined) {
        return;
      }
      if (stageCount <= 0) {
        return;
      }

      unit.stageIndex = (unit.stageIndex + 1) % stageCount;
      target.updatedAt = new Date().toISOString();
      this.markWorkDirty(target.id);
    },

    // レガシー互換性のため
    advancePanelStage(workId: string, pageId: string, panelId: string, stageCount: number) {
      this.advanceUnitStage(workId, panelId, stageCount);
    },
    setUnitChildrenCount(workId: string, unitId: string, childrenCount: number) {
      const target = this.works.find((work) => work.id === workId);
      if (!target) {
        return;
      }
      const unit = findUnitInHierarchy(target.units, unitId);
      if (!unit || !unit.children) {
        return;
      }

      const normalizedCount = normalizePositiveInteger(childrenCount, unit.children.length);
      const currentCount = unit.children.length;

      if (normalizedCount > currentCount) {
        // 子ユニットを追加
        for (let i = currentCount; i < normalizedCount; i++) {
          unit.children.push({
            id: generateId(),
            index: i + 1,
            stageIndex: 0,
          });
        }
      } else if (normalizedCount < currentCount) {
        // 子ユニットを削除
        unit.children = unit.children.slice(0, normalizedCount);
      }

      // 子ユニットのindexを再計算
      unit.children.forEach((child, index) => {
        child.index = index + 1;
      });

      target.updatedAt = new Date().toISOString();
      this.recalculateTotals(target.id);
      this.markWorkDirty(target.id);
    },

    // レガシー互換性のため
    setPagePanelCount(workId: string, pageId: string, panelCount: number) {
      this.setUnitChildrenCount(workId, pageId, panelCount);
    },

    addRootUnit(workId: string) {
      const target = this.works.find((work) => work.id === workId);
      if (!target) {
        return;
      }

      // 階層構造を動的に作成するヘルパー関数（createWorkで使用されているものと同じロジック）
      const createHierarchy = (counts: number[], depth: number = 0): WorkUnit[] => {
        if (counts.length === 0) {
          return [];
        }

        const currentCount = normalizePositiveInteger(counts[0] ?? 1, 1);
        const remainingCounts = counts.slice(1);

        return Array.from({ length: currentCount }, (_, index) => {
          const unit: WorkUnit = {
            id: generateId(),
            index: index + 1,
          };

          if (remainingCounts.length > 0) {
            // 中間レベル：子要素を持つ
            unit.children = createHierarchy(remainingCounts, depth + 1);
          } else {
            // 最下位レベル：stageIndexを持つ
            unit.stageIndex = 0;
          }

          return unit;
        });
      };

      // 作品のdefaultCountsに基づいて新しいルートユニットを作成
      const newUnits = createHierarchy([1, ...target.defaultCounts]);
      const newUnit = newUnits[0];

      if (newUnit) {
        newUnit.index = target.units.length + 1;
        target.units.push(newUnit);
        recalculateUnitIndices(target.units);
      }

      target.updatedAt = new Date().toISOString();
      this.recalculateTotals(target.id);
      this.markWorkDirty(target.id);
    },

    addChildUnit(workId: string, parentId: string) {
      const target = this.works.find((work) => work.id === workId);
      if (!target) {
        return;
      }

      const parentUnit = findUnitInHierarchy(target.units, parentId);
      if (!parentUnit) {
        return;
      }

      // デバッグ：子要素追加前の作品構造を出力


      // 親ユニットに子配列がない場合は作成
      if (!parentUnit.children) {
        parentUnit.children = [];
      }

      // 親ユニットの階層レベルを計算
      // 階層構造: [totalUnits, ...defaultCounts]
      // レベル0=totalUnits, レベル1=defaultCounts[0], レベル2=defaultCounts[1], ...
      const getUnitDepthInHierarchy = (targetUnit: WorkUnit, rootUnits: WorkUnit[], currentDepth: number = 0): number => {
        // ルートレベルで見つかった場合
        if (rootUnits.includes(targetUnit)) {
          console.log("getUnitDepthInHierarchy: found", targetUnit.id, "at depth", currentDepth);
          return currentDepth;
        }

        // 子レベルを再帰的に検索
        for (const unit of rootUnits) {
          if (unit.children) {
            const foundDepth = getUnitDepthInHierarchy(targetUnit, unit.children, currentDepth + 1);
            if (foundDepth !== -1) {
              console.log("getUnitDepthInHierarchy: found in children", targetUnit.id, "at depth", foundDepth);
              return foundDepth;
            }
          }
        }
        console.log("getUnitDepthInHierarchy: not found", targetUnit.id);
        return -1; // 見つからない場合
      };

      const parentDepth = getUnitDepthInHierarchy(parentUnit, target.units);

      // 新しいユニットの子構造を決定
      // defaultCounts = [見開き数, ページ数, コマ数]
      // parentDepth=0（見開きレベル）で追加 → ページを追加（ページはdefaultCounts[2]=コマ数個の子を持つ）
      // parentDepth=1（ページレベル）で追加 → コマを追加（コマは最下位なので子なし）

      const newUnitDepth = parentDepth + 1;
      let childCount = 0;

      if (newUnitDepth === 1) {
        // 見開きレベルに追加 → ページが追加される
        // ページは最後のdefaultCounts要素個のコマを持つ
        childCount = target.defaultCounts[target.defaultCounts.length - 1] ?? 0;  // 最後の要素（コマ数）
      } else {
        // ページレベル以下でコマ追加 → コマは最下位なので子を持たない
        childCount = 0;
      }



      // 新しい子ユニットを作成
      let newChild: WorkUnit;

      if (childCount === 0) {

        // 最下位レベル：stageIndexを持つ
        newChild = {
          id: generateId(),
          index: parentUnit.children.length + 1,
          stageIndex: 0,
        };
      } else {


        // 1つの新しいユニットの子構造を作成
        const children: WorkUnit[] = [];
        for (let i = 0; i < childCount; i++) {
          // 子要素は常に最下位（コマ）なのでstageIndexを持つ
          children.push({
            id: generateId(),
            index: i + 1,
            stageIndex: 0,
          });
        }

        // 1つの新しいユニットを作成
        newChild = {
          id: generateId(),
          index: parentUnit.children.length + 1,
          children: children,
        };
      }

      parentUnit.children.push(newChild);

      target.updatedAt = new Date().toISOString();
      this.recalculateTotals(target.id);
      this.markWorkDirty(target.id);
    },

    removeUnit(workId: string, unitId: string) {
      const target = this.works.find((work) => work.id === workId);
      if (!target) {
        return;
      }

      // 再帰的にユニットを削除する関数
      const removeFromArray = (units: WorkUnit[], targetId: string): boolean => {
        const index = units.findIndex((unit) => unit.id === targetId);
        if (index !== -1) {
          units.splice(index, 1);
          // インデックスを再計算
          units.forEach((unit, idx) => {
            unit.index = idx + 1;
          });
          return true;
        }

        // 子階層を検索
        for (const unit of units) {
          if (unit.children && removeFromArray(unit.children, targetId)) {
            return true;
          }
        }
        return false;
      };

      if (removeFromArray(target.units, unitId)) {
        target.updatedAt = new Date().toISOString();
        this.recalculateTotals(target.id);
        this.markWorkDirty(target.id);
      }
    },

    async saveWork(payload: SaveWorkPayload) {
      if (!payload.userId) {
        throw new Error("ユーザー情報が取得できませんでした。");
      }

      const target = this.works.find((work) => work.id === payload.workId);
      if (!target) {
        return;
      }

      this.setSaving(payload.workId, true);
      this.setSaveError(payload.workId, null);

      target.updatedAt = new Date().toISOString();

      try {
        await setDocument(buildWorkDocumentPath(payload.userId, payload.workId), serializeWork(target));
        this.clearWorkDirty(payload.workId);
      } catch (error) {
        this.setSaveError(payload.workId, mapError(error, "作品の保存に失敗しました。"));
        throw error;
      } finally {
        this.setSaving(payload.workId, false);
      }
    },
    async removeWork(payload: RemoveWorkPayload) {
      if (!payload.userId) {
        throw new Error("ユーザー情報が取得できませんでした。");
      }

      const index = this.works.findIndex((work) => work.id === payload.workId);
      if (index === -1) {
        return;
      }

      try {
        await deleteDocument(buildWorkDocumentPath(payload.userId, payload.workId));
      } finally {
        this.works.splice(index, 1);
        this.clearWorkDirty(payload.workId);
        this.setSaving(payload.workId, false);
        this.setSaveError(payload.workId, null);
      }
    },

    // 作品固有設定がない作品に現在の全体設定をコピー
    async migrateWorkSettings(payload: {
      workId: string;
      granularities: Granularity[];
      stageWorkloads: StageWorkload[]
    }) {
      const work = this.getWorkById(payload.workId);
      if (!work) return;

      // 既に作品固有設定がある場合はスキップ
      if ((work.workGranularities && work.workGranularities.length > 0) ||
          (work.workStageWorkloads && work.workStageWorkloads.length > 0)) {
        return;
      }

      // 全体設定をコピー
      const workGranularities: WorkGranularity[] = payload.granularities.map(g => ({
        id: g.id,
        label: g.label,
        weight: g.weight,
        defaultCount: g.defaultCount
      }));

      const workStageWorkloads: WorkStageWorkload[] = payload.stageWorkloads.map(s => ({
        id: s.id,
        label: s.label,
        color: s.color,
        baseHours: s.baseHours, // 既に計算済みのbaseHoursを使用
      }));

      // 作品を直接更新
      work.workGranularities = workGranularities;
      work.workStageWorkloads = workStageWorkloads;

      // ダーティフラグを設定
      this.markWorkDirty(payload.workId);
    },

    // 実際の進捗計算で使用される工数を計算
    calculateActualWorkHours(workId: string): { totalEstimatedHours: number; remainingEstimatedHours: number } {
      const work = this.getWorkById(workId);
      if (!work) {
        return { totalEstimatedHours: 0, remainingEstimatedHours: 0 };
      }

      // 最下位レベルのユニット（stageIndexを持つもの）を再帰的に収集
      const collectLeafUnits = (units: WorkUnit[]): WorkUnit[] => {
        const result: WorkUnit[] = [];
        for (const unit of units) {
          if (unit.stageIndex !== undefined) {
            result.push(unit);
          } else if (unit.children) {
            result.push(...collectLeafUnits(unit.children));
          }
        }
        return result;
      };

      const leafUnits = collectLeafUnits(work.units);
      const totalUnits = leafUnits.length;

      if (totalUnits === 0) {
        return { totalEstimatedHours: 0, remainingEstimatedHours: 0 };
      }

      // 作品固有設定または全体設定を使用
      const workGranularities = work.workGranularities && work.workGranularities.length > 0
        ? work.workGranularities
        : [];
      const workStageWorkloads = work.workStageWorkloads && work.workStageWorkloads.length > 0
        ? work.workStageWorkloads
        : [];



      if (work.primaryGranularityId && workStageWorkloads.length > 0 && workGranularities.length > 0) {
        // 各段階の工数を取得（baseHoursは最低粒度での工数）
        const lowestGranularity = workGranularities.reduce((min, current) =>
          current.weight < min.weight ? current : min
        );

        const stageWorkloadHours = workStageWorkloads.map(stage => {
          let baseHours = stage.baseHours;

          // 後方互換性: baseHoursがない場合はentriesから計算
          if (baseHours === null || baseHours === undefined) {
            if (stage.entries && Array.isArray(stage.entries)) {
              // 最低粒度のentriesを探す
              const lowestEntry = stage.entries.find(entry => entry.granularityId === lowestGranularity.id);
              if (lowestEntry && lowestEntry.hours !== null && lowestEntry.hours !== undefined) {
                baseHours = lowestEntry.hours;
              } else {
                // 他の粒度から最低粒度の工数に逆算
                for (const entry of stage.entries) {
                  if (entry.hours !== null && entry.hours !== undefined) {
                    const entryGranularity = workGranularities.find(g => g.id === entry.granularityId);
                    if (entryGranularity) {
                      baseHours = (entry.hours * lowestGranularity.weight) / entryGranularity.weight;
                      break;
                    }
                  }
                }
              }
            }
          }

          if (baseHours === null || baseHours === undefined) {
            return 0;
          }

          // baseHoursは最低粒度での工数なので、そのまま使用
          return baseHours;
        });

        // 各段階の累積工数を計算（進捗計算用）
        const cumulativeWorkloads = stageWorkloadHours.reduce((acc, hours, index) => {
          const prevTotal = index > 0 ? (acc[index - 1] ?? 0) : 0;
          acc.push(prevTotal + hours);
          return acc;
        }, [] as number[]);

        // 総工数は全段階の工数の合計（累積の最終値）
        const totalWorkHoursPerUnit = cumulativeWorkloads[cumulativeWorkloads.length - 1] || 0;
        const totalEstimatedHours = Number((totalWorkHoursPerUnit * totalUnits).toFixed(2));

        // 各ユニットの完了工数を計算
        const completedWorkHours = leafUnits.reduce((sum, unit) => {
          const stageIndex = unit.stageIndex ?? 0;
          // stageIndexは現在の段階を示す (0=未着手, 1=ネーム済, 2=下書済, 3=ペン入済, 4=仕上済)
          // stageIndexが指す段階まで完了しているので、その段階の累積工数を使用
          if (stageIndex >= stageWorkloadHours.length) {
            // 全段階完了の場合（最終段階を超えている場合）
            return sum + totalWorkHoursPerUnit;
          } else if (stageIndex > 0) {
            // stageIndexが1以上の場合、その段階の累積工数を使用
            // 例: stageIndex=4(仕上済)なら cumulativeWorkloads[4] を使用
            return sum + (cumulativeWorkloads[stageIndex] || 0);
          } else {
            // 未着手の場合 (stageIndex=0)
            return sum;
          }
        }, 0);

        const remainingEstimatedHours = Number((totalEstimatedHours - completedWorkHours).toFixed(2));

        return {
          totalEstimatedHours,
          remainingEstimatedHours: Math.max(0, remainingEstimatedHours)
        };
      } else {
        // 従来の計算方法（工数データがない場合）
        return {
          totalEstimatedHours: Number((work.totalUnits * work.unitEstimatedHours).toFixed(2)),
          remainingEstimatedHours: Number((work.totalUnits * work.unitEstimatedHours).toFixed(2))
        };
      }
    },
  },
});
