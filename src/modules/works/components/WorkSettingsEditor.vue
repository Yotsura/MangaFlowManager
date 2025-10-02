<template>
  <div class="work-settings-editor">
    <h5 class="mb-3">作品固有設定</h5>

    <!-- 粒度設定 -->
    <div class="mb-4">
      <h6 class="mb-2">粒度設定</h6>
      <div class="row g-2">
        <div v-for="(granularity, index) in localWorkGranularities" :key="granularity.id" class="col-12">
          <div class="card">
            <div class="card-body p-3">
              <div class="row g-2 align-items-center">
                <div class="col-4">
                  <label :for="`granularity-label-${index}`" class="form-label mb-1">ラベル</label>
                  <input
                    :id="`granularity-label-${index}`"
                    v-model="granularity.label"
                    type="text"
                    class="form-control form-control-sm"
                    placeholder="粒度名"
                  >
                </div>
                <div class="col-3">
                  <label :for="`granularity-weight-${index}`" class="form-label mb-1">重み</label>
                  <input
                    :id="`granularity-weight-${index}`"
                    v-model.number="granularity.weight"
                    type="number"
                    min="1"
                    max="10"
                    class="form-control form-control-sm"
                  >
                </div>
                <div class="col-3">
                  <button
                    type="button"
                    class="btn btn-outline-danger btn-sm mt-4"
                    @click="removeGranularity(index)"
                    :disabled="localWorkGranularities.length <= 1"
                  >
                    削除
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <button
        type="button"
        class="btn btn-outline-primary btn-sm mt-2"
        @click="addGranularity"
      >
        + 粒度を追加
      </button>
    </div>

    <!-- ステージ作業負荷設定 -->
    <div class="mb-4">
      <h6 class="mb-2">ステージ作業負荷設定</h6>
      <div class="row g-2">
        <div v-for="(stage, stageIndex) in localWorkStageWorkloads" :key="stage.id" class="col-12">
          <div class="card">
            <div class="card-body p-3">
              <div class="row g-2 align-items-center mb-2">
                <div class="col-4">
                  <label :for="`stage-label-${stageIndex}`" class="form-label mb-1">ステージ名</label>
                  <input
                    :id="`stage-label-${stageIndex}`"
                    v-model="stage.label"
                    type="text"
                    class="form-control form-control-sm"
                    placeholder="ステージ名"
                  >
                </div>
                <div class="col-3">
                  <label :for="`stage-color-${stageIndex}`" class="form-label mb-1">色</label>
                  <input
                    :id="`stage-color-${stageIndex}`"
                    v-model="stage.color"
                    type="color"
                    class="form-control form-control-color form-control-sm"
                  >
                </div>
                <div class="col-3">
                  <button
                    type="button"
                    class="btn btn-outline-danger btn-sm mt-4"
                    @click="removeStage(stageIndex)"
                    :disabled="localWorkStageWorkloads.length <= 1"
                  >
                    削除
                  </button>
                </div>
              </div>

              <!-- 各粒度の作業時間設定 -->
              <div class="row g-2">
                <div v-for="granularity in localWorkGranularities" :key="granularity.id" class="col-6 col-md-4">
                  <label :for="`stage-${stageIndex}-granularity-${granularity.id}`" class="form-label mb-1">
                    {{ granularity.label }}での作業時間
                  </label>
                  <div class="input-group input-group-sm">
                    <input
                      :id="`stage-${stageIndex}-granularity-${granularity.id}`"
                      :value="getStageHours(stage, granularity.id)"
                      @input="updateStageHours(stage, granularity.id, $event)"
                      type="number"
                      min="0"
                      step="0.1"
                      class="form-control"
                    >
                    <span class="input-group-text">時間</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <button
        type="button"
        class="btn btn-outline-primary btn-sm mt-2"
        @click="addStage"
      >
        + ステージを追加
      </button>
    </div>

    <div class="text-muted small">
      <p class="mb-1">※ 作品固有設定を変更すると、この作品のみの表示・計算に影響します。</p>
      <p class="mb-0">※ 設定を保存するには「保存」ボタンをクリックしてください。</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { generateId } from '@/utils/id';
import type { WorkGranularity, WorkStageWorkload } from '@/store/worksStore';

interface Props {
  workGranularities: WorkGranularity[];
  workStageWorkloads: WorkStageWorkload[];
}

interface Emits {
  (e: 'update:workGranularities', value: WorkGranularity[]): void;
  (e: 'update:workStageWorkloads', value: WorkStageWorkload[]): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// ローカルコピーを作成
const localWorkGranularities = computed({
  get: () => props.workGranularities,
  set: (value) => emit('update:workGranularities', value)
});

const localWorkStageWorkloads = computed({
  get: () => props.workStageWorkloads,
  set: (value) => emit('update:workStageWorkloads', value)
});

// 粒度の追加・削除
const addGranularity = () => {
  const newGranularity: WorkGranularity = {
    id: generateId(),
    label: `粒度${localWorkGranularities.value.length + 1}`,
    weight: Math.max(...localWorkGranularities.value.map(g => g.weight)) + 1
  };

  const updatedGranularities = [...localWorkGranularities.value, newGranularity];
  localWorkGranularities.value = updatedGranularities;

  // 新しい粒度に対応するステージエントリを追加
  const updatedStages = localWorkStageWorkloads.value.map(stage => ({
    ...stage,
    entries: [
      ...stage.entries,
      { granularityId: newGranularity.id, hours: 0 }
    ]
  }));
  localWorkStageWorkloads.value = updatedStages;
};

const removeGranularity = (index: number) => {
  if (localWorkGranularities.value.length <= 1) return;

  const removedGranularity = localWorkGranularities.value[index];
  if (!removedGranularity) return;

  const updatedGranularities = localWorkGranularities.value.filter((_, i) => i !== index);
  localWorkGranularities.value = updatedGranularities;

  // 削除された粒度に対応するステージエントリを削除
  const updatedStages = localWorkStageWorkloads.value.map(stage => ({
    ...stage,
    entries: stage.entries.filter(entry => entry.granularityId !== removedGranularity.id)
  }));
  localWorkStageWorkloads.value = updatedStages;
};

// ステージの追加・削除
const addStage = () => {
  const maxId = localWorkStageWorkloads.value.length > 0
    ? Math.max(...localWorkStageWorkloads.value.map(s => s.id))
    : 0;

  const newStage: WorkStageWorkload = {
    id: maxId + 1,
    label: `ステージ${localWorkStageWorkloads.value.length + 1}`,
    color: '#6c757d',
    entries: localWorkGranularities.value.map(granularity => ({
      granularityId: granularity.id,
      hours: 0
    }))
  };

  localWorkStageWorkloads.value = [...localWorkStageWorkloads.value, newStage];
};

const removeStage = (index: number) => {
  if (localWorkStageWorkloads.value.length <= 1) return;

  const updatedStages = localWorkStageWorkloads.value.filter((_, i) => i !== index);
  localWorkStageWorkloads.value = updatedStages;
};

// ステージ作業時間の取得・更新
const getStageHours = (stage: WorkStageWorkload, granularityId: string): number => {
  const entry = stage.entries.find(e => e.granularityId === granularityId);
  return entry?.hours ?? 0;
};

const updateStageHours = (stage: WorkStageWorkload, granularityId: string, event: Event) => {
  const target = event.target as HTMLInputElement;
  const hours = parseFloat(target.value) || 0;

  const updatedStages = localWorkStageWorkloads.value.map(s => {
    if (s.id === stage.id) {
      return {
        ...s,
        entries: s.entries.map(entry =>
          entry.granularityId === granularityId
            ? { ...entry, hours }
            : entry
        )
      };
    }
    return s;
  });

  localWorkStageWorkloads.value = updatedStages;
};

// 粒度変更時にステージエントリを同期
watch(localWorkGranularities, (newGranularities, oldGranularities) => {
  if (!oldGranularities) return;

  // 新しい粒度が追加された場合、既存のステージに対応エントリを追加
  // 削除された粒度がある場合、対応エントリを削除
  // この処理は addGranularity, removeGranularity で既に実装済み
}, { deep: true });
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
