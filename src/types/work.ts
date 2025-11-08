import type { WorkProgressHistory } from "./models";

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

// レガシーデータの型定義
export interface LegacyPanel {
  id?: string;
  stageIndex?: number;
}

export interface LegacyPage {
  id?: string;
  panels?: LegacyPanel[];
  panelCount?: number;
  stageIndex?: number;
}

export interface LegacyWork {
  units?: unknown[];
  defaultCounts?: unknown[];
  pages?: LegacyPage[];
  defaultPanelsPerPage?: unknown;
  [key: string]: unknown;
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

  // 進捗履歴
  progressHistory?: WorkProgressHistory[]; // 日別の進捗履歴
}

export type WorkDocument = Omit<Work, "id">;

export interface WorksState {
  works: Work[];
  worksLoaded: boolean;
  loadingWorks: boolean;
  loadError: string | null;
  savingWorkMap: Record<string, boolean>;
  saveErrorMap: Record<string, string>;
  dirtyWorkMap: Record<string, boolean>;
}

export interface CreateWorkPayload {
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

export interface RemoveWorkPayload {
  userId: string;
  workId: string;
}

export interface SaveWorkPayload {
  userId: string;
  workId: string;
}
