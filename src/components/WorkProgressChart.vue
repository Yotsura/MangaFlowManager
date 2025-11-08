<script setup lang="ts">
import { computed } from 'vue';
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
import { useWorkProgressHistory } from '@/composables/useWorkProgressHistory';

// Chart.jsの必要なコンポーネントを登録
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const { chartData, displayMode } = useWorkProgressHistory();

// グラフのタイトルと単位を表示モードに応じて変更
const chartTitle = computed(() => {
  switch (displayMode.value) {
    case 'daily':
      return '作品別 日次作業時間';
    case 'cumulative-percent':
      return '作品別 累計進捗率';
    case 'cumulative-units':
      return '作品別 累計完了工数';
    default:
      return '作品別 進捗';
  }
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

// グラフのオプション設定
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
      text: chartTitle.value
    },
    tooltip: {
      mode: 'index',
      intersect: false,
      callbacks: {
        label: (context) => {
          const label = context.dataset.label || '';
          const value = context.parsed.y;
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
</script>

<template>
  <div class="work-progress-chart">
    <div class="mb-3">
      <div class="btn-group" role="group" aria-label="表示モード切り替え">
        <input
          type="radio"
          class="btn-check"
          id="mode-daily"
          value="daily"
          v-model="displayMode"
          autocomplete="off"
        >
        <label class="btn btn-outline-primary btn-sm" for="mode-daily">日次作業時間</label>

        <input
          type="radio"
          class="btn-check"
          id="mode-cumulative-percent"
          value="cumulative-percent"
          v-model="displayMode"
          autocomplete="off"
        >
        <label class="btn btn-outline-primary btn-sm" for="mode-cumulative-percent">累計進捗率(%)</label>

        <input
          type="radio"
          class="btn-check"
          id="mode-cumulative-units"
          value="cumulative-units"
          v-model="displayMode"
          autocomplete="off"
        >
        <label class="btn btn-outline-primary btn-sm" for="mode-cumulative-units">累計完了工数</label>
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
.work-progress-chart {
  width: 100%;
  height: 100%;
}

.chart-container {
  width: 100%;
  height: 400px;
  position: relative;
}

@media (max-width: 768px) {
  .chart-container {
    height: 300px;
  }
}
</style>
