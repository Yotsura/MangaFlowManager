<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useWorksStore } from '@/store/worksStore';
import { useSettingsStore } from '@/store/settingsStore';
import { formatDate, calculateStageProgress } from '../utils/workDetailUtils';
import { normalizeStageColorValue } from '../utils/stageColor';

interface Props {
  workId: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'open-settings-modal': [];
}>();

const worksStore = useWorksStore();
const settingsStore = useSettingsStore();

const work = computed(() => worksStore.getWorkById(props.workId));
const { granularities, stageWorkloads } = storeToRefs(settingsStore);

// 作品固有設定または全体設定
const workGranularities = computed(() => {
  if (work.value?.workGranularities && work.value.workGranularities.length > 0) {
    return work.value.workGranularities;
  }
  return granularities.value;
});

const workStageWorkloads = computed(() => {
  if (work.value?.workStageWorkloads && work.value.workStageWorkloads.length > 0) {
    return work.value.workStageWorkloads;
  }
  return stageWorkloads.value;
});

const stageLabels = computed(() => workStageWorkloads.value.map((stage) => stage.label));
const stageColors = computed(() => {
  const total = workStageWorkloads.value.length;
  return workStageWorkloads.value.map((stage, index) => normalizeStageColorValue(stage.color, index, total));
});

const stageWorkloadHours = computed(() => {
  const workData = work.value;
  if (!workData?.primaryGranularityId || workStageWorkloads.value.length === 0) {
    return [];
  }

  return workStageWorkloads.value.map(stage => {
    if ('baseHours' in stage && stage.baseHours !== null && stage.baseHours !== undefined) {
      return stage.baseHours;
    }

    if ('entries' in stage && Array.isArray(stage.entries)) {
      const lowestGranularity = workGranularities.value.reduce((min, current) =>
        current.weight < min.weight ? current : min
      );

      const lowestEntry = stage.entries.find(e => e.granularityId === lowestGranularity.id);
      if (lowestEntry?.hours != null) {
        return lowestEntry.hours;
      }

      for (const entry of stage.entries) {
        if (entry.hours != null) {
          const entryGranularity = workGranularities.value.find(g => g.id === entry.granularityId);
          if (entryGranularity) {
            const ratio = lowestGranularity.weight / entryGranularity.weight;
            return entry.hours * ratio;
          }
        }
      }
    }

    return 0;
  });
});

const formattedUpdateDate = computed(() => work.value ? formatDate(work.value.updatedAt) : '');

// 各工程の進捗率を計算（共通関数を使用）
const getStageProgress = (stageIndex: number) => {
  if (!work.value || !work.value.units) {
    return 0;
  }
  return calculateStageProgress(work.value.units, stageIndex);
};


</script>

<template>
  <div class="card shadow-sm h-100">
    <div class="card-body">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h6 class="mb-0">工程設定</h6>
        <button
          type="button"
          class="btn btn-sm btn-outline-primary"
          @click="emit('open-settings-modal')"
        >
          <i class="bi bi-gear"></i>
        </button>
      </div>

      <!-- 工程別進捗 - 横並びレイアウト -->
      <div class="d-flex flex-column gap-2">
        <div
          v-for="(label, index) in stageLabels"
          :key="index"
          class="stage-progress-item"
        >
          <!-- PC表示: 縦並び -->
          <div class="d-none d-md-block">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <span class="small fw-semibold">{{ label }} ({{ stageWorkloadHours[index] }}h)</span>
              <span class="small text-muted">{{ getStageProgress(index) }}%</span>
            </div>
            <div class="progress" style="height: 20px;">
              <div
                class="progress-bar"
                :style="{
                  width: getStageProgress(index) + '%',
                  backgroundColor: stageColors[index]
                }"
                role="progressbar"
                :aria-valuenow="getStageProgress(index)"
                aria-valuemin="0"
                aria-valuemax="100"
              ></div>
            </div>
          </div>

          <!-- スマホ表示: 横並び -->
          <div class="d-md-none d-flex align-items-center gap-2">
            <span class="small fw-semibold text-nowrap" style="min-width: 80px;">{{ label }} ({{ stageWorkloadHours[index] }}h)</span>
            <div class="progress flex-grow-1" style="height: 16px;">
              <div
                class="progress-bar"
                :style="{
                  width: getStageProgress(index) + '%',
                  backgroundColor: stageColors[index]
                }"
                role="progressbar"
                :aria-valuenow="getStageProgress(index)"
                aria-valuemin="0"
                aria-valuemax="100"
              ></div>
            </div>
            <span class="small text-muted text-nowrap" style="min-width: 35px;">{{ getStageProgress(index) }}%</span>
          </div>
        </div>
      </div>

      <div class="mt-3 text-muted small text-end">
        <span class="badge text-bg-light">更新: {{ formattedUpdateDate }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stage-progress-item {
  padding: 0.5rem;
  background-color: #f8f9fa;
  border-radius: 0.375rem;
}

.stage-progress-item:hover {
  background-color: #e9ecef;
}

.progress-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 500;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  transition: width 0.3s ease;
}

/* スマホ表示でのパディング調整 */
@media (max-width: 767px) {
  .stage-progress-item {
    padding: 0.375rem 0.5rem;
  }
}
</style>
