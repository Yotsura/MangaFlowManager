import { defineStore } from "pinia";

import { generateId } from "@/utils/id";

export const WORK_STATUSES = ["未着手", "作業中", "完了", "保留"] as const;
export type WorkStatus = (typeof WORK_STATUSES)[number];

export interface WorkPage {
  id: string;
  index: number;
  panelCount: number;
  stageIndex: number;
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

interface WorksState {
  works: Work[];
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
  workId: string;
}

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

export const useWorksStore = defineStore("works", {
  state: (): WorksState => ({
    works: [],
  }),
  getters: {
    getWorkById: (state) => (id: string) => state.works.find((work) => work.id === id),
  },
  actions: {
    createWork(payload: CreateWorkPayload): Work {
      const now = new Date().toISOString();
      const totalUnits = normalizePositiveInteger(payload.totalUnits, 1);
      const defaultPanels = normalizePositiveInteger(payload.defaultPanelsPerPage, 1);

      const pages: WorkPage[] = Array.from({ length: totalUnits }, (_, index) => ({
        id: generateId(),
        index: index + 1,
        panelCount: defaultPanels,
        stageIndex: 0,
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
    },
    recalculateTotals(workId: string) {
      const target = this.works.find((work) => work.id === workId);
      if (!target) {
        return;
      }
      target.totalUnits = target.pages.length;
      target.totalEstimatedHours = Number((target.totalUnits * target.unitEstimatedHours).toFixed(2));
      target.updatedAt = new Date().toISOString();
    },
    advancePageStage(workId: string, pageId: string, stageCount: number) {
      const target = this.works.find((work) => work.id === workId);
      if (!target) {
        return;
      }
      const page = target.pages.find((entry) => entry.id === pageId);
      if (!page) {
        return;
      }
      if (stageCount <= 0) {
        return;
      }

      page.stageIndex = (page.stageIndex + 1) % stageCount;
      target.updatedAt = new Date().toISOString();
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

      page.panelCount = normalizePositiveInteger(panelCount, page.panelCount);
      target.updatedAt = new Date().toISOString();
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
        panelCount: defaultPanels,
        stageIndex: 0,
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
    removeWork(payload: RemoveWorkPayload) {
      const index = this.works.findIndex((work) => work.id === payload.workId);
      if (index === -1) {
        return;
      }

      this.works.splice(index, 1);
    },
  },
});
