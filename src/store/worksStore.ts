import { defineStore } from "pinia";

import { deleteDocument, getCollectionDocs, getDocument, setDocument } from "@/services/firebase/firestoreService";
import { generateId } from "@/utils/id";

export const WORK_STATUSES = ["未着手", "作業中", "完了", "保留"] as const;
export type WorkStatus = (typeof WORK_STATUSES)[number];

export interface WorkPanel {
  id: string;
  index: number;
  stageIndex: number;
}

export interface WorkPage {
  id: string;
  index: number;
  panels: WorkPanel[];
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
  defaultPanelsPerPage: number;
  primaryGranularityId: string | null;
  unitEstimatedHours: number;
  totalEstimatedHours: number;
  pages: WorkPage[];
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
  defaultPanelsPerPage: number;
  primaryGranularityId: string | null;
  unitEstimatedHours: number;
}

interface MovePagePayload {
  workId: string;
  pageId: string;
  afterPageId: string | null;
}

interface RemovePagePayload {
  workId: string;
  pageId: string;
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

const recalculatePageIndices = (pages: WorkPage[]) => {
  pages.forEach((page, index) => {
    page.index = index + 1;
  });
};

const normalizePanel = (raw: unknown, fallbackIndex: number): WorkPanel | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const data = raw as Record<string, unknown>;

  const id = typeof data.id === "string" && data.id.trim().length > 0 ? data.id : generateId();
  const indexRaw = Number(data.index);
  const index = Number.isFinite(indexRaw) && indexRaw > 0 ? Math.floor(indexRaw) : fallbackIndex;
  const stageRaw = Number(data.stageIndex);
  const stageIndex = Number.isFinite(stageRaw) && stageRaw >= 0 ? Math.floor(stageRaw) : 0;

  return {
    id,
    index,
    stageIndex,
  } satisfies WorkPanel;
};

const normalizePage = (raw: unknown, fallbackIndex: number): WorkPage | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const data = raw as Record<string, unknown>;

  const id = typeof data.id === "string" && data.id.trim().length > 0 ? data.id : generateId();
  const indexRaw = Number(data.index);
  const index = Number.isFinite(indexRaw) && indexRaw > 0 ? Math.floor(indexRaw) : fallbackIndex;

  // 旧データ形式との互換性を保つ
  let panels: WorkPanel[] = [];

  if (Array.isArray(data.panels)) {
    // 新形式: panelsプロパティがある場合
    panels = data.panels
      .map((panelRaw, panelIndex) => normalizePanel(panelRaw, panelIndex + 1))
      .filter((panel): panel is WorkPanel => panel !== null)
      .map((panel, panelIndex) => ({ ...panel, index: panelIndex + 1 }));
  } else {
    // 旧形式: panelCountとstageIndexがある場合
    const panelRaw = Number(data.panelCount);
    const panelCount = Number.isFinite(panelRaw) && panelRaw > 0 ? Math.floor(panelRaw) : 1;
    const stageRaw = Number(data.stageIndex);
    const stageIndex = Number.isFinite(stageRaw) && stageRaw >= 0 ? Math.floor(stageRaw) : 0;

    // panelCountの数だけパネルを作成（全て同じstageIndex）
    panels = Array.from({ length: panelCount }, (_, panelIndex) => ({
      id: generateId(),
      index: panelIndex + 1,
      stageIndex,
    }));
  }

  return {
    id,
    index,
    panels,
  } satisfies WorkPage;
};

const mapDocumentToWork = (item: WorkDocument & { id: string }): Work => {
  const createdAt = typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString();
  const updatedAt = typeof item.updatedAt === "string" ? item.updatedAt : createdAt;

  const pagesRaw = Array.isArray(item.pages) ? item.pages : [];
  const pages = pagesRaw
    .map((entry, index) => normalizePage(entry, index + 1))
    .filter((entry): entry is WorkPage => entry !== null)
    .map((entry, index) => ({ ...entry, index: index + 1 }));

  const totalUnits = Number.isFinite(Number(item.totalUnits)) && Number(item.totalUnits) > 0 ? Math.floor(Number(item.totalUnits)) : pages.length;
  const unitEstimatedHours = Number.isFinite(Number(item.unitEstimatedHours)) && Number(item.unitEstimatedHours) >= 0 ? Number(item.unitEstimatedHours) : 0;
  const totalEstimatedHours = Number.isFinite(Number(item.totalEstimatedHours)) && Number(item.totalEstimatedHours) >= 0 ? Number(item.totalEstimatedHours) : Number((totalUnits * unitEstimatedHours).toFixed(2));
  const defaultPanels = Number.isFinite(Number(item.defaultPanelsPerPage)) && Number(item.defaultPanelsPerPage) > 0 ? Math.floor(Number(item.defaultPanelsPerPage)) : 1;

  return {
    id: item.id,
    title: typeof item.title === "string" ? item.title : "",
    status: WORK_STATUSES.includes(item.status as WorkStatus) ? (item.status as WorkStatus) : WORK_STATUSES[0],
    startDate: typeof item.startDate === "string" ? item.startDate : "",
    deadline: typeof item.deadline === "string" ? item.deadline : "",
    createdAt,
    updatedAt,
    totalUnits,
    defaultPanelsPerPage: defaultPanels,
    primaryGranularityId: typeof item.primaryGranularityId === "string" ? item.primaryGranularityId : null,
    unitEstimatedHours,
    totalEstimatedHours,
    pages,
  } satisfies Work;
};

const serializeWork = (work: Work): WorkDocument => ({
  title: work.title,
  status: work.status,
  startDate: work.startDate,
  deadline: work.deadline,
  createdAt: work.createdAt,
  updatedAt: work.updatedAt,
  totalUnits: work.totalUnits,
  defaultPanelsPerPage: work.defaultPanelsPerPage,
  primaryGranularityId: work.primaryGranularityId,
  unitEstimatedHours: work.unitEstimatedHours,
  totalEstimatedHours: work.totalEstimatedHours,
  pages: work.pages.map((page) => ({
    id: page.id,
    index: page.index,
    panels: page.panels.map((panel) => ({
      id: panel.id,
      index: panel.index,
      stageIndex: panel.stageIndex,
    })),
  })),
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
          const index = this.works.findIndex(work => work.id === workId);
          if (index !== -1) {
            this.works[index] = normalizedWork;
          } else {
            this.works.push(normalizedWork);
          }

          // dirty状態をクリア
          this.clearWorkDirty(workId);
        }
      } catch (error) {
        console.error('Failed to fetch work:', error);
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
      const defaultPanels = normalizePositiveInteger(payload.defaultPanelsPerPage, 1);

      const pages: WorkPage[] = Array.from({ length: totalUnits }, (_, index) => ({
        id: generateId(),
        index: index + 1,
        panels: Array.from({ length: defaultPanels }, (_, panelIndex) => ({
          id: generateId(),
          index: panelIndex + 1,
          stageIndex: 0,
        })),
      }));

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
        defaultPanelsPerPage: defaultPanels,
        primaryGranularityId: payload.primaryGranularityId,
        unitEstimatedHours,
        totalEstimatedHours: Number((totalUnits * unitEstimatedHours).toFixed(2)),
        pages,
      };

      this.works.push(work);
      this.worksLoaded = true;
      this.markWorkDirty(work.id);
      this.setSaveError(work.id, null);
      return work;
    },
    updateWork(id: string, patch: Partial<Pick<Work, "title" | "status" | "startDate" | "deadline" | "defaultPanelsPerPage" | "unitEstimatedHours">>) {
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
      if (patch.defaultPanelsPerPage !== undefined) {
        target.defaultPanelsPerPage = normalizePositiveInteger(patch.defaultPanelsPerPage, target.defaultPanelsPerPage);
      }
      if (patch.unitEstimatedHours !== undefined) {
        target.unitEstimatedHours = Math.max(0, patch.unitEstimatedHours);
        shouldRecalculateTotals = true;
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
      target.totalUnits = target.pages.length;
      target.totalEstimatedHours = Number((target.totalUnits * target.unitEstimatedHours).toFixed(2));
      target.updatedAt = new Date().toISOString();
      this.markWorkDirty(target.id);
    },
    advancePanelStage(workId: string, pageId: string, panelId: string, stageCount: number) {
      const target = this.works.find((work) => work.id === workId);
      if (!target) {
        return;
      }
      const page = target.pages.find((entry) => entry.id === pageId);
      if (!page) {
        return;
      }
      const panel = page.panels.find((entry) => entry.id === panelId);
      if (!panel) {
        return;
      }
      if (stageCount <= 0) {
        return;
      }

      panel.stageIndex = (panel.stageIndex + 1) % stageCount;
      target.updatedAt = new Date().toISOString();
      this.markWorkDirty(target.id);
    },
    setPagePanelCount(workId: string, pageId: string, panelCount: number) {
      const target = this.works.find((work) => work.id === workId);
      if (!target) {
        return;
      }
      const page = target.pages.find((entry) => entry.id === pageId);
      if (!page) {
        return;
      }

      const normalizedCount = normalizePositiveInteger(panelCount, page.panels.length);
      const currentCount = page.panels.length;

      if (normalizedCount > currentCount) {
        // パネルを追加
        for (let i = currentCount; i < normalizedCount; i++) {
          page.panels.push({
            id: generateId(),
            index: i + 1,
            stageIndex: 0,
          });
        }
      } else if (normalizedCount < currentCount) {
        // パネルを削除
        page.panels = page.panels.slice(0, normalizedCount);
      }

      // パネルのindexを再計算
      page.panels.forEach((panel, index) => {
        panel.index = index + 1;
      });

      target.updatedAt = new Date().toISOString();
      this.recalculateTotals(target.id);
      this.markWorkDirty(target.id);
    },
    movePage(payload: MovePagePayload) {
      const target = this.works.find((work) => work.id === payload.workId);
      if (!target) {
        return;
      }

      const currentIndex = target.pages.findIndex((page) => page.id === payload.pageId);
      if (currentIndex === -1) {
        return;
      }

      const [extracted] = target.pages.splice(currentIndex, 1);
      if (!extracted) {
        return;
      }

      const page = extracted;

      if (payload.afterPageId === null) {
        target.pages.unshift(page);
      } else {
        const afterIndex = target.pages.findIndex((entry) => entry.id === payload.afterPageId);
        if (afterIndex === -1) {
          target.pages.push(page);
        } else {
          target.pages.splice(afterIndex + 1, 0, page);
        }
      }

      recalculatePageIndices(target.pages);
      this.recalculateTotals(target.id);
      this.markWorkDirty(target.id);
    },
    addPage(workId: string, panelCount?: number) {
      const target = this.works.find((work) => work.id === workId);
      if (!target) {
        return;
      }

      const nextIndex = target.pages.length + 1;
      const defaultPanels = panelCount ? normalizePositiveInteger(panelCount, target.defaultPanelsPerPage) : target.defaultPanelsPerPage;

      target.pages.push({
        id: generateId(),
        index: nextIndex,
        panels: Array.from({ length: defaultPanels }, (_, panelIndex) => ({
          id: generateId(),
          index: panelIndex + 1,
          stageIndex: 0,
        })),
      });

      this.recalculateTotals(target.id);
    },
    removePage(payload: RemovePagePayload) {
      const target = this.works.find((work) => work.id === payload.workId);
      if (!target) {
        return;
      }

      const index = target.pages.findIndex((page) => page.id === payload.pageId);
      if (index === -1) {
        return;
      }

      target.pages.splice(index, 1);
      recalculatePageIndices(target.pages);
      this.recalculateTotals(target.id);
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
  },
});
