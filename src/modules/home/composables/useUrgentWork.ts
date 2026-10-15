import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useSettingsStore } from '@/store/settingsStore';
import { useWorksStore } from '@/store/worksStore';
import { useWorkMetrics } from '@/composables/useWorkMetrics';

/**
 * 最も緊急度の高い作品を取得するcomposable
 */
export function useUrgentWork() {
  const settingsStore = useSettingsStore();
  const worksStore = useWorksStore();

  const { workHours } = storeToRefs(settingsStore);
  const { works } = storeToRefs(worksStore);

  // 作業ペース計算
  const workPaceCalculations = computed(() => {
    if (!workHours.value.length || !works.value.length) {
      return [];
    }

    return works.value
      .map(work => {
        // 締切があり、完了していない作品のみ
        if (!work.deadline || work.status === '完了') {
          return null;
        }

        const workRef = computed(() => work);
        const metrics = useWorkMetrics(workRef);
        const totalRemainingHours = metrics.remainingEstimatedHours.value;

        if (totalRemainingHours <= 0) {
          return null;
        }

        const paceCalculation = metrics.workPaceCalculation.value;
        if (!paceCalculation) {
          return null;
        }

        const workProgress = worksStore.calculateActualWorkHours(work.id);

        return {
          work,
          totalRemainingHours,
          totalEstimatedHours: workProgress.totalEstimatedHours,
          progressPercentage: workProgress.progressPercentage,
          paceCalculation
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  });

  // 最も緊急度の高い作品
  const mostUrgentWork = computed(() => {
    const validCalculations = workPaceCalculations.value;
    if (validCalculations.length === 0) return null;

    return validCalculations.reduce((prev, current) => {
      if (!prev) return current;

      // 締切が近い順、そして作業負荷が高い順
      const prevRatio = prev.totalRemainingHours / (prev.paceCalculation.remainingWorkableHours || 1);
      const currentRatio = current.totalRemainingHours / (current.paceCalculation.remainingWorkableHours || 1);

      if (current.paceCalculation.daysUntilDeadline < prev.paceCalculation.daysUntilDeadline) {
        return current;
      }

      if (current.paceCalculation.daysUntilDeadline === prev.paceCalculation.daysUntilDeadline) {
        return currentRatio > prevRatio ? current : prev;
      }

      return prev;
    });
  });

  return {
    workPaceCalculations,
    mostUrgentWork
  };
}
