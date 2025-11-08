import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useWorksStore } from '@/store/worksStore';
import { useWorkMetrics } from '@/composables/useWorkMetrics';

/**
 * 締切が設定されている作品のリストを取得するcomposable
 * 各作品の進捗情報と締切までの情報を含む
 */
export function useDeadlineWorks() {
  const worksStore = useWorksStore();
  const { works } = storeToRefs(worksStore);

  const worksWithDeadline = computed(() => {
    return works.value
      .filter(work => work.deadline && work.status !== '完了')
      .map(work => {
        const metrics = worksStore.calculateActualWorkHours(work.id);
        const workComputed = computed(() => work);
        const workMetrics = useWorkMetrics(workComputed);

        return {
          id: work.id,
          title: work.title,
          deadline: work.deadline,
          progressPercentage: metrics.progressPercentage,
          remainingHours: metrics.remainingEstimatedHours,
          totalHours: metrics.totalEstimatedHours,
          daysUntilDeadline: workMetrics.daysUntilDeadline.value,
          availableWorkHours: workMetrics.availableWorkHours.value
        };
      })
      .sort((a, b) => {
        // 締切の近い順にソート
        return new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime();
      });
  });

  return {
    worksWithDeadline
  };
}
