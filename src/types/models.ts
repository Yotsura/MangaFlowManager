export interface WorkStage {
  name: string;
  workload: number;
}

export interface WorkPage {
  index: number;
  panels: number;
  stages: WorkStage[];
}

export interface WorkItem {
  id: string;
  title: string;
  status: "未着手" | "作業中" | "完了" | "保留";
  totalWorkload: number;
  deadline?: string;
  pages: WorkPage[];
}

/**
 * 作業段階ごとのユニット数カウント
 * stageId が null の場合は「全工程完了（最終段階を超過）」を表す
 */
export interface UnitStageCountEntry {
  stageId: number | null;
  count: number;
}

export type UnitStageCounts = UnitStageCountEntry[];

/**
 * 作品の日別進捗履歴
 * 工数操作があった日付とその時点での完了工数を記録
 */
export interface WorkProgressHistory {
  /** 記録日（YYYY-MM-DD形式） */
  date: string;
  /** その日の時点での作業済み工数（時間） - 旧プロパティ */
  completedHours?: number;
  /** ステージごとの到達ユニット数（最低粒度単位） */
  unitStageCounts?: UnitStageCounts;
  /** 記録日時のタイムスタンプ */
  timestamp: number;
}

