import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useSettingsStore } from '@/store/settingsStore';
import { useWorksStore } from '@/store/worksStore';
import { useCustomDatesStore } from '@/store/customDatesStore';
import { calculateWorkPace } from '@/utils/workloadUtils';
import type { Holiday } from '@/utils/dateUtils';

/**
 * 最も緊急度の高い作品を取得するcomposable
 */
export function useUrgentWork(holidays: Holiday[]) {
  const settingsStore = useSettingsStore();
  const worksStore = useWorksStore();
  const customDatesStore = useCustomDatesStore();

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

        const metrics = worksStore.calculateActualWorkHours(work.id);
        const totalRemainingHours = metrics.remainingEstimatedHours;

        if (totalRemainingHours <= 0) {
          return null;
        }

        const paceCalculation = calculateWorkPace(
          new Date(work.deadline),
          totalRemainingHours,
          metrics.progressPercentage / 100,
          workHours.value,
          holidays,
          customDatesStore.customDates
        );

        return {
          work,
          totalRemainingHours,
          totalEstimatedHours: metrics.totalEstimatedHours,
          progressPercentage: metrics.progressPercentage,
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
