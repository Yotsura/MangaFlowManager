import { defineStore } from "pinia";

interface WorkSummary {
  id: string;
  title: string;
  status: "未着手" | "作業中" | "完了" | "保留";
}

interface WorksState {
  works: WorkSummary[];
}

export const useWorksStore = defineStore("works", {
  state: (): WorksState => ({
    works: [],
  }),
  actions: {
    addWork(work: WorkSummary) {
      this.works.push(work);
    },
  },
});
