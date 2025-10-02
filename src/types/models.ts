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
