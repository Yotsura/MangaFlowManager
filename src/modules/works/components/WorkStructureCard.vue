<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useWorksStore } from '@/store/worksStore';
import { useSettingsStore } from '@/store/settingsStore';
import PanelStyleUnitEditor from './PanelStyleUnitEditor.vue';
import { normalizeStageColorValue } from '../utils/stageColor';

interface Props {
  workId: string;
  isEditMode: boolean;
  savingUnitIds: Set<string>;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'advance-stage': [payload: { unitId: string }];
  'add-root-unit': [];
  'add-child': [payload: { parentId: string }];
  'remove-unit': [payload: { unitId: string }];
  'update-children-count': [payload: { unitId: string; count: number }];
  'open-structure-modal': [];
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

const sortedGranularities = computed(() => {
  return [...workGranularities.value].sort((a, b) => b.weight - a.weight);
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
</script>

<template>
  <div class="card shadow-sm">
    <div class="card-body">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h2 class="h5 mb-1">作品構造管理</h2>
          <p class="text-muted mb-0 small">階層構造でユニットを管理できます。要素をクリックして作業段階を進めましょう。</p>
        </div>
        <div class="d-flex gap-2">
          <button
            type="button"
            class="btn btn-sm btn-outline-primary"
            @click="emit('open-structure-modal')"
          >
            <i class="bi bi-pencil"></i>
            <span class="d-none d-md-inline ms-1">構造文字列編集</span>
          </button>
        </div>
      </div>

      <!-- 作品構造管理UI -->
      <PanelStyleUnitEditor
        :units="work?.units || []"
        :stage-count="stageCount"
        :stage-labels="stageLabels"
        :stage-colors="stageColors"
        :stage-workloads="stageWorkloadHours"
        :granularities="sortedGranularities"
        :is-edit-mode="isEditMode"
        :saving-unit-ids="savingUnitIds"
        @advance-stage="emit('advance-stage', $event)"
        @add-root-unit="emit('add-root-unit')"
        @add-child="emit('add-child', $event)"
        @remove-unit="emit('remove-unit', $event)"
        @update-children-count="emit('update-children-count', $event)"
      />
    </div>
  </div>
</template>
