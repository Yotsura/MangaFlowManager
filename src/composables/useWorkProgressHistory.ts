import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useWorksStore } from '@/store/worksStore';
import { useSettingsStore } from '@/store/settingsStore';
import { getDateRange } from '@/utils/dateUtils';
import { buildStageWorkloadMetrics, calculateCompletedHoursFromStageCounts } from '@/utils/workStoreHelpers';
import { cloneStageCounts, normalizeUnitStageCounts } from '@/utils/workProgressUtils';
import type { UnitStageCountEntry } from '@/types/models';

export type ProgressDisplayMode = 'daily' | 'cumulative-percent' | 'cumulative-units';

/**
 * 作品の進捗履歴をグラフ用のデータ形式に変換するcomposable
 *
 * 各作品のデータ範囲（最初の前日～最後の日）のみを表示し、
 * 日付が飛んでいる場合は前日の累計値を保持（進捗0）として扱います。
 */
export function useWorkProgressHistory() {
  const worksStore = useWorksStore();
  const { works } = storeToRefs(worksStore);
  const settingsStore = useSettingsStore();
  const { granularities, stageWorkloads } = storeToRefs(settingsStore);

  // 表示モード
  const displayMode = ref<ProgressDisplayMode>('daily');

  // 日付範囲フィルタ
  const startDateFilter = ref<string>('');
  const endDateFilter = ref<string>('');

  /**
   * グラフ用のデータセット（作品ごと）
   */
  const progressDatasets = computed(() => {
    return works.value
      .filter(work => work.progressHistory && work.progressHistory.length > 0)
      .map(work => {
        const history = work.progressHistory || [];
        const stageMetrics = buildStageWorkloadMetrics(
          work,
          granularities.value,
          stageWorkloads.value
        );

        // 最初のデータから最後のデータまでの範囲
        const startDate = history[0].date;
        const endDate = history[history.length - 1].date;
        const allDatesInRange = getDateRange(startDate, endDate);

        // 各日付のデータを生成（reduceで前の値を参照しながら構築）
        const dataPoints = allDatesInRange.reduce((acc, date, index) => {
          const historyEntry = history.find(h => h.date === date);
          const previousPoint = index > 0 ? acc[index - 1] : null;
          const isFirstDay = index === 0;
          const previousStageCounts = previousPoint?.unitStageCounts ?? [];

          if (historyEntry) {
            const hasStructuredStageCounts = Array.isArray(historyEntry.unitStageCounts)
              && historyEntry.unitStageCounts.some(entry => entry && typeof entry === 'object' && 'stageId' in entry);
            const normalizedCounts = hasStructuredStageCounts
              ? normalizeUnitStageCounts(historyEntry.unitStageCounts, stageMetrics)
              : [];
            const hasActualStageCounts = normalizedCounts.length > 0;

            const rawDerivedHours = hasActualStageCounts
              ? calculateCompletedHoursFromStageCounts(normalizedCounts, stageMetrics)
              : 0;
            const derivedCompletedHours = Number.isFinite(rawDerivedHours) ? rawDerivedHours : 0;

            const previousCompleted = previousPoint ? previousPoint.completedHours : 0;
            const currentCompletedHours = hasActualStageCounts
              ? derivedCompletedHours
              : (historyEntry.completedHours ?? previousCompleted);

            const diff = currentCompletedHours - previousCompleted;
            const stageCounts = hasActualStageCounts
              ? cloneStageCounts(normalizedCounts)
              : cloneStageCounts(previousStageCounts);

            acc.push({
              date,
              completedHours: Number(currentCompletedHours.toFixed(2)),
              hoursWorked: isFirstDay ? 0 : Number(diff.toFixed(2)),
              isFirstDay,
              unitStageCounts: stageCounts,
              hasActualStageCounts
            });
          } else {
            const previousCompleted = previousPoint ? previousPoint.completedHours : 0;
            acc.push({
              date,
              completedHours: previousCompleted,
              hoursWorked: 0,
              isFirstDay,
              unitStageCounts: cloneStageCounts(previousStageCounts),
              hasActualStageCounts: false
            });
          }
          return acc;
        }, [] as Array<{
          date: string;
          completedHours: number;
          hoursWorked: number;
          isFirstDay: boolean;
          unitStageCounts: UnitStageCountEntry[];
          hasActualStageCounts: boolean;
        }>);

        return {
          workId: work.id,
          workTitle: work.title,
          dateRange: allDatesInRange,
          data: dataPoints
        };
      });
  });

  /**
   * 全作品の日付リスト（ユニーク、ソート済み、フィルタ適用後）
   */
  const allDates = computed(() => {
    const datesSet = new Set<string>();

    progressDatasets.value.forEach(dataset => {
      dataset.dateRange.forEach(date => {
        datesSet.add(date);
      });
    });

    let dates = Array.from(datesSet).sort();

    // 日付範囲フィルタを適用
    if (startDateFilter.value) {
      dates = dates.filter(date => date >= startDateFilter.value);
    }
    if (endDateFilter.value) {
      dates = dates.filter(date => date <= endDateFilter.value);
    }

    return dates;
  });

  /**
   * Chart.js用のデータ形式に変換
   */
  const chartData = computed(() => {
    const dates = allDates.value;
    const mode = displayMode.value;

    const datasets = progressDatasets.value.map((dataset, index) => {
      // 各作品の色を自動生成（HSL形式で色相を分散）
      const hue = (index * 360 / progressDatasets.value.length) % 360;
      const color = `hsl(${hue}, 70%, 50%)`;

      // 作品データを取得
      const work = works.value.find(w => w.id === dataset.workId);
      if (!work) return null;

      // 作品の総工数を共通関数から取得
      const workMetrics = worksStore.calculateActualWorkHours(dataset.workId);
      const totalHours = workMetrics.totalEstimatedHours || 1;

      // この作品の日付範囲外はnullにして線を引かない
      const data = dates.map(date => {
        // この作品の日付範囲内かチェック
        if (!dataset.dateRange.includes(date)) {
          return null;
        }

        const point = dataset.data.find(p => p.date === date);
        if (!point) return null;

        if (mode === 'daily') {
          // 日次作業時間モード: 初日はnullで表示しない
          if (point.isFirstDay) {
            return null;
          }
          return point.hoursWorked;
        } else if (mode === 'cumulative-percent') {
          // 累計進捗率モード: 共通関数から取得した総工数で計算
          return (point.completedHours / totalHours) * 100;
        } else {
          // 累計完了工数モード（時間で表示）
          return point.completedHours;
        }
      });

      return {
        label: dataset.workTitle,
        data,
        borderColor: color,
        backgroundColor: `hsla(${hue}, 70%, 50%, 0.1)`,
        borderWidth: 2,
        tension: 0.1,
        pointRadius: 4,
        pointHoverRadius: 6,
        spanGaps: false // nullの部分は線を引かない
      };
    }).filter(d => d !== null);

    return {
      labels: dates.map(date => {
        // YYYY-MM-DD を MM/DD に変換
        const parts = date.split('-');
        return `${parts[1]}/${parts[2]}`;
      }),
      datasets
    };
  });

  return {
    displayMode,
    startDateFilter,
    endDateFilter,
    progressDatasets,
    allDates,
    chartData
  };
}
