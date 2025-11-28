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
import { useWorksStore } from '@/store/worksStore';
import { useWorkProgressHistory } from '@/composables/useWorkProgressHistory';

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
const { progressDatasets } = useWorkProgressHistory();

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

  const dataValues = points.map(point => {
    if (displayMode.value === 'daily') {
      return point.isFirstDay ? null : Number(point.hoursWorked.toFixed(1));
    }
    if (displayMode.value === 'cumulative-percent') {
      return Number(((point.completedHours / totalHours) * 100).toFixed(1));
    }
    return Number(point.completedHours.toFixed(1));
  });

  const hue = 210;
  const color = `hsl(${hue}, 70%, 50%)`;

  return {
    labels,
    datasets: [
      {
        label: work.value?.title ?? '作品',
        data: dataValues,
        borderColor: color,
        backgroundColor: `hsla(${hue}, 70%, 50%, 0.15)`,
        borderWidth: 2,
        tension: 0.1,
        pointRadius: 4,
        pointHoverRadius: 6,
        spanGaps: false
      }
    ]
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
          return `${label}: ${value.toFixed(1)}${tooltipSuffix.value}`;
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
