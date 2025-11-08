<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useWorksStore } from '@/store/worksStore';
import { useSettingsStore } from '@/store/settingsStore';
import ProgressHeatmap from './ProgressHeatmap.vue';
import { formatDate } from '../utils/workDetailUtils';
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

const stageCount = computed(() => workStageWorkloads.value.length);
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
</script>

<template>
  <div class="card shadow-sm h-100">
    <div class="card-body">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h6 class="mb-0">工程設定</h6>
        <div class="d-flex gap-2">
          <button
            type="button"
            class="btn btn-sm btn-outline-primary"
            @click="emit('open-settings-modal')"
          >
            <i class="bi bi-gear"></i>
            <span class="d-none d-md-inline ms-1">編集</span>
          </button>
        </div>
      </div>

      <!-- 工程別進捗 -->
      <ProgressHeatmap
        :units="work?.units || []"
        :stage-count="stageCount"
        :stage-labels="stageLabels"
        :stage-colors="stageColors"
        :stage-workload-hours="stageWorkloadHours"
      />
      <div class="mt-3 text-muted small">
        <span class="badge text-bg-light">更新: {{ formattedUpdateDate }}</span>
      </div>
    </div>
  </div>
</template>
