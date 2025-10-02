import { computed, ref } from "vue";

export interface WorkloadInput {
  totalPanels: number;
  deadlineDays: number;
}

export const useWorkloadCalculator = () => {
  const input = ref<WorkloadInput>({ totalPanels: 0, deadlineDays: 1 });

  const panelsPerDay = computed(() => {
    if (input.value.deadlineDays <= 0) {
      return 0;
    }

    return Math.ceil(input.value.totalPanels / input.value.deadlineDays);
  });

  return { input, panelsPerDay };
};
