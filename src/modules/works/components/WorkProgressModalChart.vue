<script setup lang="ts">
import { computed, ref } from 'vue';
import { Line } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  type ChartOptions
} from 'chart.js';
import { storeToRefs } from 'pinia';
import { useWorksStore } from '@/store/worksStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useWorkProgressHistory } from '@/composables/useWorkProgressHistory';
import { buildStageWorkloadMetrics } from '@/utils/workStoreHelpers';
import { hexToRgba, resolveStageColors, resolveStageIdOrder, resolveStageLabels } from '@/utils/workProgressUtils';
import type { UnitStageCountEntry } from '@/types/models';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const displayModes = [
  { value: 'daily', label: '日次作業時間' },
  { value: 'cumulative-percent', label: '累計進捗率(%)' },
  { value: 'cumulative-units', label: '累計完了工数' }
] as const;

type DisplayMode = typeof displayModes[number]['value'];

interface Props {
  workId: string;
}

const props = defineProps<Props>();
const worksStore = useWorksStore();
const settingsStore = useSettingsStore();
const { progressDatasets } = useWorkProgressHistory();
const { granularities, stageWorkloads } = storeToRefs(settingsStore);

const displayMode = ref<DisplayMode>('daily');
const startDateFilter = ref('');
const endDateFilter = ref('');

const work = computed(() => worksStore.getWorkById(props.workId));
const workDataset = computed(() =>
  progressDatasets.value.find(dataset => dataset.workId === props.workId) || null
);

const actualMetrics = computed(() => worksStore.calculateActualWorkHours(props.workId));

type ProgressPoint = {
  date: string;
  completedHours: number;
  hoursWorked: number;
  isFirstDay: boolean;
  unitStageCounts: UnitStageCountEntry[];
  hasActualStageCounts: boolean;
};

const progressPoints = computed<ProgressPoint[]>(() => {
  const dataset = workDataset.value;
  if (!dataset) {
    return [];
  }
  return dataset.data as ProgressPoint[];
});

const filteredPoints = computed(() => {
  return progressPoints.value.filter(point => {
    if (startDateFilter.value && point.date < startDateFilter.value) {
      return false;
    }
    if (endDateFilter.value && point.date > endDateFilter.value) {
      return false;
    }
    return true;
  });
});

const stageMetrics = computed(() => {
  if (!work.value) {
    return null;
  }
  return buildStageWorkloadMetrics(
    work.value,
    granularities.value,
    stageWorkloads.value
  );
});

const resolvedStageWorkloads = computed(() => {
  const custom = work.value?.workStageWorkloads;
  if (custom && custom.length > 0) {
    return custom;
  }
  return stageWorkloads.value;
});

const stageLabels = computed(() => resolveStageLabels(resolvedStageWorkloads.value));

const stageColors = computed(() => resolveStageColors(resolvedStageWorkloads.value));

const stageIdOrder = computed(() => resolveStageIdOrder(resolvedStageWorkloads.value));

const hasStageSeries = computed(() =>
  !!stageMetrics.value && filteredPoints.value.some(point => point.hasActualStageCounts)
);

const yAxisLabel = computed(() => {
  switch (displayMode.value) {
    case 'daily':
      return '作業時間 (h)';
    case 'cumulative-percent':
      return '進捗率 (%)';
    case 'cumulative-units':
      return '完了工数 (h)';
    default:
      return '';
  }
});

const tooltipSuffix = computed(() => {
  switch (displayMode.value) {
    case 'daily':
      return 'h';
    case 'cumulative-percent':
      return '%';
    case 'cumulative-units':
      return 'h';
    default:
      return '';
  }
});

const chartData = computed(() => {
  const points = filteredPoints.value;
  if (!points.length) {
    return { labels: [] as string[], datasets: [] };
  }

  const labels = points.map(point => {
    const [, month, day] = point.date.split('-');
    return `${month}/${day}`;
  });

  const totalHours = actualMetrics.value.totalEstimatedHours || 1;
  const metrics = stageMetrics.value;
  const includeStageData = hasStageSeries.value && !!metrics;
  const stageCount = includeStageData && metrics ? metrics.stageWorkloadHours.length : 0;
  const stageSeries = includeStageData
    ? Array.from({ length: stageCount }, () => Array(points.length).fill(null) as (number | null)[])
    : [];

  const filteredIndexByDate = includeStageData
    ? new Map(points.map((point, index) => [point.date, index]))
    : null;

  const stageLabelsLocal = includeStageData ? stageLabels.value : [];
  const stageColorsLocal = includeStageData ? stageColors.value : [];
  const stageIdOrderLocal = includeStageData ? stageIdOrder.value : [];
  const stageIndexById = includeStageData
    ? new Map(stageIdOrderLocal.map((stageId, index) => [stageId, index]))
    : null;
  const stageCumulativeHours = includeStageData && metrics
    ? metrics.stageWorkloadHours.reduce((acc: number[], hours, idx) => {
        const normalized = Number.isFinite(hours) ? Number(hours) : 0;
        const previous = idx > 0 ? acc[idx - 1] : 0;
        acc.push(Number((previous + normalized).toFixed(4)));
        return acc;
      }, [] as number[])
    : [];
  let stageUnitsReached: number[] = [];
  let totalUnitsForStage = 0;

  let previousStageValues: number[] | null = includeStageData ? new Array(stageCount).fill(0) : null;
  let actualStageCountsDays = 0;

  if (includeStageData && filteredIndexByDate && stageIndexById) {
    const computeStageStats = (entries: UnitStageCountEntry[] | undefined) => {
      const rawCounts = new Array(stageCount + 1).fill(0);

      (entries ?? []).forEach(entry => {
        if (!entry) {
          return;
        }

        const numeric = Number(entry.count);
        if (!Number.isFinite(numeric) || numeric <= 0) {
          return;
        }

        const parsed = Math.floor(numeric);
        if (parsed <= 0) {
          return;
        }

        const stageId = typeof entry.stageId === 'number' ? entry.stageId : null;

        if (stageId === null || !stageIndexById.has(stageId)) {
          rawCounts[stageCount] += parsed;
          return;
        }

        const slotIndex = stageIndexById.get(stageId);
        if (slotIndex === undefined) {
          rawCounts[stageCount] += parsed;
          return;
        }

        rawCounts[slotIndex] += parsed;
      });

      const totalUnits = rawCounts.reduce((sum, value) => sum + (Number(value) || 0), 0);

      const unitsReached = stageLabelsLocal.map((_, stageIdx) => {
        const startIndex = Math.min(stageIdx, rawCounts.length - 1);
        return rawCounts
          .slice(startIndex, rawCounts.length)
          .reduce((sum, value) => sum + (Number(value) || 0), 0);
      });

      const stageValues = stageLabelsLocal.map((_, stageIdx) => {
        const unitsReachedStage = unitsReached[stageIdx] ?? 0;
        const cumulativeHours = stageCumulativeHours[stageIdx] ?? 0;
        return Number((unitsReachedStage * cumulativeHours).toFixed(2));
      });

      return {
        stageValues,
        unitsReached,
        totalUnits
      };
    };

    progressPoints.value.forEach(point => {
      if (!previousStageValues) {
        previousStageValues = new Array(stageCount).fill(0);
      }

      let stageValues = [...previousStageValues];

      if (point.hasActualStageCounts && point.unitStageCounts.length > 0) {
        actualStageCountsDays += 1;
        const stats = computeStageStats(point.unitStageCounts);
        stageValues = stats.stageValues;
        stageUnitsReached = stats.unitsReached;
        totalUnitsForStage = stats.totalUnits;
      } else if (actualStageCountsDays === 0) {
        const filteredIndex = filteredIndexByDate.get(point.date);
        if (filteredIndex !== undefined) {
          stageSeries.forEach(series => {
            series[filteredIndex] = null;
          });
        }
        previousStageValues = stageValues;
        return;
      }

      const filteredIndex = filteredIndexByDate.get(point.date);
      if (filteredIndex !== undefined) {
        const hideStageDaily = displayMode.value === 'daily' && actualStageCountsDays <= 1;

        stageValues.forEach((value, stageIdx) => {
          let seriesValue: number | null;
          if (displayMode.value === 'daily') {
            if (hideStageDaily) {
              seriesValue = null;
            } else {
              const previousValue = previousStageValues ? previousStageValues[stageIdx] ?? 0 : 0;
              seriesValue = Number((value - previousValue).toFixed(2));
            }
          } else if (displayMode.value === 'cumulative-percent') {
            const unitsReached = stageUnitsReached[stageIdx] ?? 0;
            const percent = totalUnitsForStage > 0 ? (unitsReached / totalUnitsForStage) * 100 : 0;
            seriesValue = Number(percent.toFixed(1));
          } else {
            seriesValue = value;
          }

          stageSeries[stageIdx][filteredIndex] = hideStageDaily ? null : seriesValue;
        });
      }

      previousStageValues = stageValues;
    });
  }

  const totalDataValues = points.map(point => {
    if (displayMode.value === 'daily') {
      return point.isFirstDay ? null : Number(point.hoursWorked.toFixed(2));
    }
    if (displayMode.value === 'cumulative-percent') {
      const percent = totalHours > 0 ? (point.completedHours / totalHours) * 100 : 0;
      return Number(percent.toFixed(1));
    }
    return Number(point.completedHours.toFixed(2));
  });

  const hue = 210;
  const color = `hsl(${hue}, 70%, 50%)`;

  const datasets = [
    {
      label: 'Total',
      data: totalDataValues,
      borderColor: color,
      backgroundColor: `hsla(${hue}, 70%, 50%, 0.15)`,
      borderWidth: 2,
      tension: 0.1,
      pointRadius: 4,
      pointHoverRadius: 6,
      spanGaps: false
    }
  ];

  if (includeStageData) {
    stageSeries.forEach((data, index) => {
      const baseColor = stageColorsLocal[index] ?? '#0d6efd';
      datasets.push({
        label: stageLabelsLocal[index] ?? `Stage ${index + 1}`,
        data,
        borderColor: baseColor,
        backgroundColor: hexToRgba(baseColor, 0.12),
        borderWidth: 2,
        tension: 0.15,
        pointRadius: 3,
        pointHoverRadius: 5,
        spanGaps: false
      });
    });
  }

  return {
    labels,
    datasets
  };
});

const chartOptions = computed<ChartOptions<'line'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'top'
    },
    title: {
      display: true,
      text: '作品進捗グラフ'
    },
    tooltip: {
      mode: 'index',
      intersect: false,
      callbacks: {
        label: (context) => {
          const label = context.dataset.label || '';
          const value = context.parsed.y;
          if (value === null) {
            return `${label}: データなし`;
          }
          const decimals = displayMode.value === 'cumulative-percent' ? 1 : 2;
          return `${label}: ${value.toFixed(decimals)}${tooltipSuffix.value}`;
        }
      }
    }
  },
  scales: {
    x: {
      title: {
        display: true,
        text: '日付'
      }
    },
    y: {
      title: {
        display: true,
        text: yAxisLabel.value
      },
      beginAtZero: true
    }
  },
  interaction: {
    mode: 'nearest',
    axis: 'x',
    intersect: false
  }
}));

const clearDateFilters = () => {
  startDateFilter.value = '';
  endDateFilter.value = '';
};
</script>

<template>
  <div class="single-work-progress-chart">
    <div class="mb-3 d-flex flex-wrap align-items-center justify-content-between gap-3">
      <div class="btn-group" role="group" aria-label="表示モード切り替え">
        <template v-for="mode in displayModes" :key="mode.value">
          <input
            type="radio"
            class="btn-check"
            :id="`single-mode-${mode.value}`"
            :value="mode.value"
            v-model="displayMode"
            autocomplete="off"
          />
          <label class="btn btn-outline-primary btn-sm" :for="`single-mode-${mode.value}`">
            {{ mode.label }}
          </label>
        </template>
      </div>

      <div class="d-flex align-items-center gap-2 flex-wrap">
        <div class="d-flex align-items-center gap-1">
          <label for="single-start-date-filter" class="form-label mb-0 text-nowrap small">開始:</label>
          <input
            id="single-start-date-filter"
            type="date"
            class="form-control form-control-sm"
            v-model="startDateFilter"
            style="min-width: 140px;"
          />
        </div>
        <div class="d-flex align-items-center gap-1">
          <label for="single-end-date-filter" class="form-label mb-0 text-nowrap small">終了:</label>
          <input
            id="single-end-date-filter"
            type="date"
            class="form-control form-control-sm"
            v-model="endDateFilter"
            style="min-width: 140px;"
          />
        </div>
        <button
          v-if="startDateFilter || endDateFilter"
          class="btn btn-sm btn-outline-secondary"
          @click="clearDateFilters"
          title="フィルタをクリア"
        >
          <i class="bi bi-x-circle"></i>
        </button>
      </div>
    </div>

    <div v-if="chartData.datasets.length === 0" class="text-center py-5 text-muted">
      <i class="bi bi-graph-up fs-1 d-block mb-3"></i>
      <p class="mb-0">進捗データがまだありません</p>
      <small>作品の工程を進めると、日次の作業履歴が記録されます</small>
    </div>
    <div v-else class="chart-container">
      <Line :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>

<style scoped>
.single-work-progress-chart {
  width: 100%;
  height: 100%;
}

.chart-container {
  width: 100%;
  height: 420px;
  position: relative;
}

@media (max-width: 768px) {
  .chart-container {
    height: 300px;
  }
}
</style>
