import { defineStore } from "pinia";

interface CalendarState {
  currentMonth: string;
}

export const useCalendarStore = defineStore("calendar", {
  state: (): CalendarState => ({
    currentMonth: new Date().toISOString().slice(0, 7),
  }),
  actions: {
    setMonth(month: string) {
      this.currentMonth = month;
    },
  },
});
