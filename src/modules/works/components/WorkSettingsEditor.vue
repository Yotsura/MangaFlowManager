<template>
  <div class="work-settings-editor">
    <h5 class="mb-4">作品固有設定</h5>

    <!-- 粒度設定 -->
    <div class="mb-5">
      <h6 class="mb-3">粒度設定</h6>
      <GranularityTable
        :granularities="workGranularities"
        @save="handleGranularitySave"
      />
    </div>

    <!-- ステージ作業負荷設定 -->
    <div class="mb-4">
      <h6 class="mb-3">ステージ作業負荷設定</h6>
      <StageWorkloadEditor
        :granularities="workGranularities"
        :stage-workloads="workStageWorkloads"
        @save="handleStageWorkloadSave"
      />
    </div>

    <div class="text-muted small mt-4 pt-3 border-top">
      <p class="mb-1">※ 作品固有設定を変更すると、この作品のみの表示・計算に影響します。</p>
      <p class="mb-0">※ 設定を保存するには「保存」ボタンをクリックしてください。</p>
    </div>
  </div>
</template><script setup lang="ts">
import GranularityTable from '@/modules/settings/components/GranularityTable.vue';
import StageWorkloadEditor from '@/modules/settings/components/StageWorkloadEditor.vue';
import type { WorkGranularity, WorkStageWorkload } from '@/store/worksStore';

interface Props {
  workGranularities: WorkGranularity[];
  workStageWorkloads: WorkStageWorkload[];
}

interface Emits {
  (e: 'update:workGranularities', value: WorkGranularity[]): void;
  (e: 'update:workStageWorkloads', value: WorkStageWorkload[]): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

// 粒度設定の保存イベント
const handleGranularitySave = (granularities: WorkGranularity[]) => {
  emit('update:workGranularities', granularities);
};

// ステージ作業負荷設定の保存イベント
const handleStageWorkloadSave = (stageWorkloads: WorkStageWorkload[]) => {
  emit('update:workStageWorkloads', stageWorkloads);
};
</script>

<style scoped>
.work-settings-editor .card {
  border: 1px solid #e9ecef;
}

.work-settings-editor .card-body {
  background-color: #f8f9fa;
}

.form-control-sm {
  font-size: 0.875rem;
}

.input-group-sm .input-group-text {
  font-size: 0.875rem;
}
</style>
