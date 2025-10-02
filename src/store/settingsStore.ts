import { defineStore } from "pinia";

interface WorkHourRange {
  day: string;
  start: string;
  end: string;
}

interface SettingsState {
  workHours: WorkHourRange[];
}

export const useSettingsStore = defineStore("settings", {
  state: (): SettingsState => ({
    workHours: [],
  }),
  actions: {
    setWorkHours(hours: WorkHourRange[]) {
      this.workHours = hours;
    },
  },
});
