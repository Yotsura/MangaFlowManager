import { defineStore } from "pinia";
import { deleteDocument, getCollectionDocs, getDocument, setDocument } from "@/services/firebase/firestoreService";
import { generateId } from "@/utils/id";
import type { Granularity, StageWorkload } from "@/store/settingsStore";
import { useSettingsStore } from "@/store/settingsStore";
import { formatLocalDate } from "@/utils/dateUtils";
import type { WorkProgressHistory } from "@/types/models";

// 型定義をインポート
export type {
  Work,
  WorkUnit,
  WorkGranularity,
  WorkStageWorkload,
  WorkStageWorkloadEntry,
  WorkStatus,
  WorkDocument,
  WorksState,
  CreateWorkPayload,
  RemoveWorkPayload,
  SaveWorkPayload,
} from "@/types/work";
export { WORK_STATUSES } from "@/types/work";
import type {
  Work,
  WorkUnit,
  WorkGranularity,
  WorkStageWorkload,
  WorkStatus,
  WorkDocument,
  WorksState,
  CreateWorkPayload,
  RemoveWorkPayload,
  SaveWorkPayload,
} from "@/types/work";

// ヘルパー関数をインポート
import {
  mapError,
  buildWorkCollectionPath,
  buildWorkDocumentPath,
  normalizePositiveInteger,
  recalculateUnitIndices,
  findUnitInHierarchy,
  getAllLeafUnits,
  getActualWorkDepth,
  getUnitDepthInHierarchy,
  buildStageWorkloadMetrics,
} from "@/utils/workStoreHelpers";

// シリアライゼーション関数をインポート
import { mapDocumentToWork, serializeWork } from "@/utils/workSerializer";

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

      // 未保存の変更がある場合は再読み込みをスキップ
      if (this.dirtyWorkMap[workId]) {
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

    // 構造指定による作品作成
    createWorkWithStructure(payload: {
      title: string;
      status: WorkStatus;
      startDate: string;
      deadline: string;
      primaryGranularityId: string;
      unitEstimatedHours: number;
      workGranularities?: WorkGranularity[];
      workStageWorkloads?: WorkStageWorkload[];
      structure: {
        topLevelUnits: { leafCount: number; stageIndices: number[] }[];
        hierarchicalUnits?: { children: { leafCount: number; stageIndices: number[] }[] }[];
      };
    }) {
      const now = new Date().toISOString();
      const totalUnits = payload.structure.topLevelUnits.length;
      const totalLeafUnits = payload.structure.topLevelUnits.reduce((sum, unit) => sum + unit.leafCount, 0);

      // 構造に基づいて階層を作成
      let units: WorkUnit[];

      if (payload.structure.hierarchicalUnits) {
        // 3階層構造の場合
        units = payload.structure.hierarchicalUnits.map((topUnit, topIndex) => ({
          id: generateId(),
          index: topIndex + 1,
          children: topUnit.children.map((midUnit, midIndex) => ({
            id: generateId(),
            index: midIndex + 1,
            children: Array.from({ length: midUnit.leafCount }, (_, leafIndex) => ({
              id: generateId(),
              index: leafIndex + 1,
              stageIndex: midUnit.stageIndices[leafIndex] || 0,
            })),
          })),
        }));
      } else {
        // 2階層構造の場合（従来通り）
        units = payload.structure.topLevelUnits.map((topUnit, topIndex) => ({
          id: generateId(),
          index: topIndex + 1,
          children: Array.from({ length: topUnit.leafCount }, (_, leafIndex) => ({
            id: generateId(),
            index: leafIndex + 1,
            stageIndex: topUnit.stageIndices[leafIndex] || 0,
          })),
        }));
      }

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
        defaultCounts: [Math.ceil(totalLeafUnits / totalUnits)], // 平均的な下位ユニット数
        primaryGranularityId: payload.primaryGranularityId,
        unitEstimatedHours,
        totalEstimatedHours: Number((totalLeafUnits * unitEstimatedHours).toFixed(2)),
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

        // 粒度設定が変更された場合、defaultCountsも更新
        if (target.workGranularities.length > 0) {
          const newDefaultCounts = target.workGranularities
            .sort((a, b) => b.weight - a.weight) // 上位から下位の順にソート
            .map(g => g.defaultCount);

          target.defaultCounts = newDefaultCounts;
        }
      }

      if (patch.workStageWorkloads !== undefined) {
        target.workStageWorkloads = patch.workStageWorkloads;
      }

      if (shouldRecalculateTotals) {
        target.totalEstimatedHours = Number((target.totalUnits * target.unitEstimatedHours).toFixed(2));
      }

      target.updatedAt = new Date().toISOString();
      this.markWorkDirty(target.id);

      // 工数設定が変更された場合は進捗履歴を記録
      if (shouldRecalculateTotals) {
        this.recordProgressHistory(id);
      }
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

      // 進捗履歴を記録
      this.recordProgressHistory(workId);
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

      // 進捗履歴を記録
      this.recordProgressHistory(workId);
    },
    updateUnitStage(workId: string, unitId: string, newStage: number) {
      const target = this.works.find((work) => work.id === workId);
      if (!target) {
        return;
      }

      const unit = findUnitInHierarchy(target.units, unitId);
      if (!unit || unit.stageIndex === undefined) {
        return;
      }

      unit.stageIndex = Math.max(0, newStage);
      target.updatedAt = new Date().toISOString();
      this.markWorkDirty(target.id);

      // 進捗履歴を記録
      this.recordProgressHistory(workId);
    },

    // 最下位ユニットの作業段階を一括更新
    applyStageIndicesToLeafUnits(workId: string, stageIndices: number[]) {
      const target = this.works.find((work) => work.id === workId);
      if (!target) {
        return false;
      }

      const leafUnits = getAllLeafUnits(target.units);

      // 作業段階インデックスの数と最下位ユニット数が一致しない場合は適用しない
      if (leafUnits.length !== stageIndices.length) {
        console.warn(`作業段階数(${stageIndices.length})と最下位ユニット数(${leafUnits.length})が一致しません`);
        return false;
      }

      // 各最下位ユニットに作業段階を適用
      leafUnits.forEach((unit, index) => {
        unit.stageIndex = Math.max(0, stageIndices[index] || 0);
      });

      target.updatedAt = new Date().toISOString();
      this.markWorkDirty(target.id);
      return true;
    },

    // 既存作品の構造を上書き
    overwriteWorkStructure(workId: string, structure: {
      topLevelUnits: { leafCount: number; stageIndices: number[] }[];
      hierarchicalUnits?: { children: { leafCount: number; stageIndices: number[] }[] }[];
    }) {
      const target = this.works.find((work) => work.id === workId);
      if (!target) {
        return false;
      }

      let newUnits: WorkUnit[];
      let totalLeafUnits: number;
      let totalUnits: number;

      if (structure.hierarchicalUnits) {
        // 3階層構造の場合
        totalLeafUnits = structure.hierarchicalUnits.reduce((sum, topUnit) =>
          sum + topUnit.children.reduce((childSum, child) => childSum + child.leafCount, 0), 0
        );
        totalUnits = structure.hierarchicalUnits.length;

        newUnits = structure.hierarchicalUnits.map((topUnit, topIndex) => ({
          id: generateId(),
          index: topIndex + 1,
          children: topUnit.children.map((midUnit, midIndex) => ({
            id: generateId(),
            index: midIndex + 1,
            children: Array.from({ length: midUnit.leafCount }, (_, leafIndex) => ({
              id: generateId(),
              index: leafIndex + 1,
              stageIndex: midUnit.stageIndices[leafIndex] || 0,
            })),
          })),
        }));
      } else {
        // 2階層構造の場合（従来通り）
        totalLeafUnits = structure.topLevelUnits.reduce((sum, unit) => sum + unit.leafCount, 0);
        totalUnits = structure.topLevelUnits.length;

        newUnits = structure.topLevelUnits.map((topUnit, topIndex) => ({
          id: generateId(),
          index: topIndex + 1,
          children: Array.from({ length: topUnit.leafCount }, (_, leafIndex) => ({
            id: generateId(),
            index: leafIndex + 1,
            stageIndex: topUnit.stageIndices[leafIndex] || 0,
          })),
        }));
      }

      // 作品の構造を更新
      target.units = newUnits;
      target.totalUnits = totalUnits;
      target.totalEstimatedHours = Number((totalLeafUnits * target.unitEstimatedHours).toFixed(2));
      target.updatedAt = new Date().toISOString();
      this.markWorkDirty(target.id);

      // 進捗履歴を記録
      this.recordProgressHistory(workId);

      return true;
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

      const actualDepth = getActualWorkDepth(target.units);

      // 作品固有の粒度設定を優先、なければ実際の深度に基づくデフォルト値を使用
      let defaultCounts: number[];

      if (target.workGranularities && target.workGranularities.length > 0) {
        // 作品固有設定がある場合：それを使用
        defaultCounts = target.workGranularities
          .sort((a, b) => b.weight - a.weight)
          .map(g => g.defaultCount);
      } else {
        // 作品固有設定がない場合：実際の階層深度に基づくデフォルト値を使用
        if (actualDepth === 2) {
          // 2階層作品：ページ→コマ構造
          defaultCounts = [4]; // デフォルト4コマ
        } else if (actualDepth === 3) {
          // 3階層作品：見開き→ページ→コマ構造
          defaultCounts = [2, 4]; // デフォルト2ページ、4コマ
        } else {
          // その他：既存の設定をフォールバック
          defaultCounts = target.defaultCounts;
        }
      }

      // 粒度設定に基づいて適切な階層構造を作成
      // ルートユニット追加時は、最上位の粒度単位を1つ追加する
      // 例：「ページ＞コマ」設定で「ページ」を追加 → [1, コマ数]
      // 例：「見開き＞ページ＞コマ」設定で「見開き」を追加 → [1, ページ数, コマ数]

      let hierarchyCounts: number[];
      if (defaultCounts.length === 0) {
        // フォールバック：設定なしの場合
        hierarchyCounts = [1];
      } else if (defaultCounts.length === 1) {
        // 1階層設定：例えば「コマ」のみ → 1つのコマを追加
        hierarchyCounts = [1];
      } else {
        // 2階層以上：最上位粒度を1つ、その下の階層は設定通り
        // defaultCounts[0] = 最上位の子数、defaultCounts[1] = 次の階層の子数、...
        hierarchyCounts = [1, ...defaultCounts.slice(1)];
      }

      // 新しいルートユニットを作成
      const newUnits = createHierarchy(hierarchyCounts);
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

      // 親ユニットに子配列がない場合は作成
      if (!parentUnit.children) {
        parentUnit.children = [];
      }

      const parentDepth = getUnitDepthInHierarchy(parentUnit, target.units);
      const actualDepth = getActualWorkDepth(target.units);

      // 作品固有の粒度設定を優先、なければ実際の深度に基づくデフォルト値を使用
      let defaultCounts: number[];

      if (target.workGranularities && target.workGranularities.length > 0) {
        // 作品固有設定がある場合：それを使用
        defaultCounts = target.workGranularities
          .sort((a, b) => b.weight - a.weight)
          .map(g => g.defaultCount);
      } else {
        // 作品固有設定がない場合：実際の階層深度に基づくデフォルト値を使用
        if (actualDepth === 2) {
          // 2階層作品：ページ→コマ構造
          defaultCounts = [4]; // デフォルト4コマ
        } else if (actualDepth === 3) {
          // 3階層作品：見開き→ページ→コマ構造
          defaultCounts = [2, 4]; // デフォルト2ページ、4コマ
        } else {
          // その他：既存の設定をフォールバック
          defaultCounts = target.defaultCounts;
        }
      }

      // 新しいユニットの子構造を決定
      // defaultCounts = [見開き数, ページ数, コマ数]
      // parentDepth=0（見開きレベル）で追加 → ページを追加（ページはdefaultCounts[2]=コマ数個の子を持つ）
      // parentDepth=1（ページレベル）で追加 → コマを追加（コマは最下位なので子なし）

      const newUnitDepth = parentDepth + 1;
      let childCount = 0;

      // 汎用的な階層構造判定：新しいユニットが最下位レベルかどうかを動的に判定
      // actualDepth=3の場合、最下位はdepth=2（0ベース）
      const isLeafLevel = newUnitDepth >= (actualDepth - 1);

      if (isLeafLevel) {
        // 最下位レベル：子を持たない（コマレベル）
        childCount = 0;
      } else {
        // 中間レベル：次の階層のデフォルト数だけ子を持つ
        // defaultCountsは [階層1のデフォルト数, 階層2のデフォルト数, ...] の順
        // newUnitDepth=0なら、その子（階層1）のデフォルト数 = defaultCounts[0]
        // newUnitDepth=1なら、その子（階層2）のデフォルト数 = defaultCounts[1]
        const childCountIndex = newUnitDepth;
        if (childCountIndex < defaultCounts.length) {
          childCount = defaultCounts[childCountIndex] ?? 0;
        } else {
          // デフォルト設定がない場合は最後の値を使用
          childCount = defaultCounts[defaultCounts.length - 1] ?? 0;
        }
      }      // 新しい子ユニットを作成
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
    /**
     * 作品の実際の工数と進捗率を計算
     * @param workId 作品ID
     * @returns 総推定工数、残り推定工数、完了工数、進捗率、ページ数、総コマ数、平均コマ数/ページ
     */
    calculateActualWorkHours(workId: string): {
      totalEstimatedHours: number;
      remainingEstimatedHours: number;
      completedEstimatedHours: number;
      progressPercentage: number;
      pageCount: number;
      totalPanels: number;
      averagePanelsPerPage: number;
    } {
      const work = this.getWorkById(workId);
      if (!work) {
        return {
          totalEstimatedHours: 0,
          remainingEstimatedHours: 0,
          completedEstimatedHours: 0,
          progressPercentage: 0,
          pageCount: 0,
          totalPanels: 0,
          averagePanelsPerPage: 0
        };
      }

      const leafUnits = getAllLeafUnits(work.units);
      const totalUnits = leafUnits.length;

      // ページ数（最上位レベルのユニット数）
      const pageCount = work.units.length;

      // 総コマ数（最下位レベルのユニット数 = leafUnits.length）
      const totalPanels = totalUnits;

      // 平均コマ数/ページ
      const averagePanelsPerPage = pageCount > 0 ? Number((totalPanels / pageCount).toFixed(2)) : 0;

      if (totalUnits === 0) {
        return {
          totalEstimatedHours: 0,
          remainingEstimatedHours: 0,
          completedEstimatedHours: 0,
          progressPercentage: 0,
          pageCount,
          totalPanels,
          averagePanelsPerPage
        };
      }

      const settingsStore = useSettingsStore();
      const stageMetrics = buildStageWorkloadMetrics(
        work,
        settingsStore.granularities,
        settingsStore.stageWorkloads
      );

      if (stageMetrics) {
        const stageCount = stageMetrics.stageWorkloadHours.length;
        const totalWorkHoursPerUnit = stageMetrics.totalWorkHoursPerUnit;
        const totalEstimatedHours = Number((totalWorkHoursPerUnit * totalUnits).toFixed(2));

        const completedWorkHours = leafUnits.reduce((sum, unit) => {
          const stageIndex = Math.max(0, Math.min(unit.stageIndex ?? 0, stageCount));

          if (stageIndex === 0) {
            return sum;
          }

          if (stageIndex >= stageCount) {
            return sum + totalWorkHoursPerUnit;
          }

          return sum + (stageMetrics.cumulativeWorkloads[stageIndex] || 0);
        }, 0);

        const completedEstimatedHours = Number(completedWorkHours.toFixed(2));
        const remainingEstimatedHours = Number((totalEstimatedHours - completedWorkHours).toFixed(2));
        const progressPercentage = totalEstimatedHours > 0
          ? Math.round((completedWorkHours / totalEstimatedHours) * 100)
          : 0;

        return {
          totalEstimatedHours,
          remainingEstimatedHours: Math.max(0, remainingEstimatedHours),
          completedEstimatedHours,
          progressPercentage,
          pageCount,
          totalPanels,
          averagePanelsPerPage
        };
      }

      // 従来の計算方法（工数データがない場合）
      const stageCount = settingsStore.stageWorkloads.length;

      const completedUnits = stageCount > 0
        ? leafUnits.filter(unit => (unit.stageIndex ?? 0) >= stageCount - 1).length
        : 0;

      const totalEstimatedHours = Number((work.totalUnits * work.unitEstimatedHours).toFixed(2));
      const completedEstimatedHours = Number((completedUnits * work.unitEstimatedHours).toFixed(2));
      const remainingEstimatedHours = Number((totalEstimatedHours - completedEstimatedHours).toFixed(2));
      const progressPercentage = totalUnits > 0
        ? Math.round((completedUnits / totalUnits) * 100)
        : 0;

      return {
        totalEstimatedHours,
        remainingEstimatedHours: Math.max(0, remainingEstimatedHours),
        completedEstimatedHours,
        progressPercentage,
        pageCount,
        totalPanels,
        averagePanelsPerPage
      };
    },

    /**
     * 作品の進捗履歴を記録
     * 工数変更があった日の完了工数を記録
     */
    recordProgressHistory(workId: string) {
      const work = this.works.find(w => w.id === workId);
      if (!work) return;

      const today = formatLocalDate(new Date());
      const metrics = this.calculateActualWorkHours(workId);
      const completedHours = metrics.completedEstimatedHours;

      const settingsStore = useSettingsStore();
      const stageMetrics = buildStageWorkloadMetrics(
        work,
        settingsStore.granularities,
        settingsStore.stageWorkloads
      );

      let unitStageCounts: number[] | undefined;

      if (stageMetrics) {
        const stageCount = stageMetrics.stageWorkloadHours.length;
        const counts = new Array(stageCount + 1).fill(0);
        const leafUnits = getAllLeafUnits(work.units);

        for (const unit of leafUnits) {
          const stageIndex = Math.max(0, Math.min(unit.stageIndex ?? 0, stageCount));
          counts[stageIndex] += 1;
        }

        unitStageCounts = counts;
      }

      // 進捗履歴を初期化（存在しない場合）
      if (!work.progressHistory) {
        work.progressHistory = [];
      }

      // 今日の記録が既に存在するか確認
      const existingIndex = work.progressHistory.findIndex(h => h.date === today);

      const historyEntryBase = {
        date: today,
        completedHours,
        timestamp: Date.now(),
        ...(unitStageCounts ? { unitStageCounts } : {})
      } as WorkProgressHistory;

      if (existingIndex >= 0) {
        // 既存の記録を更新
        work.progressHistory[existingIndex] = historyEntryBase;
      } else {
        // 新しい記録を追加
        work.progressHistory.push(historyEntryBase);
      }

      // 日付順にソート
      work.progressHistory.sort((a, b) => a.date.localeCompare(b.date));

      // 作品を更新済みとしてマーク
      this.dirtyWorkMap[workId] = true;
    },

    /**
     * 作品の進捗履歴を取得
     */
    getProgressHistory(workId: string): WorkProgressHistory[] {
      const work = this.works.find(w => w.id === workId);
      return work?.progressHistory || [];
    },

    /**
     * テスト用: 全作品にサンプル進捗履歴を生成
     */
    generateTestProgressHistory() {
      for (const work of this.works) {
        // 作品ごとに異なるテストデータを生成
        let testData: { date: string; completedHours: number }[] | null = null;

        if (work.title.toLowerCase() === 'フェイなの本') {
          testData = [
            { date: '2025-11-03', completedHours: 52.2 },
            { date: '2025-11-06', completedHours: 55.4 },
            { date: '2025-11-08', completedHours: 58.2 },
          ];
        } else if (work.title.toLowerCase() === 'test') {
          testData = [
            { date: '2025-11-05', completedHours: 3.5 },
            { date: '2025-11-07', completedHours: 5.2 },
            { date: '2025-11-08', completedHours: 9 },
          ];
        }

        // 指定した作品以外はスキップ
        if (!testData) { continue; }

        const history: WorkProgressHistory[] = testData.map(item => ({
          date: item.date,
          completedHours: Math.round(item.completedHours * 10) / 10,
          timestamp: new Date(item.date).getTime()
        }));

        work.progressHistory = history;
        this.markWorkDirty(work.id);
      }
    },
  },
});

