<template>
  <div class="integrated-settings-editor">
    <div class="row g-4">
      <!-- 作業粒度設定 -->
      <div class="col-12 col-lg-6">
        <div class="card h-100" :class="{ 'border-primary': granularityModified }">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h6 class="mb-0">
              <i class="bi bi-grid-3x3-gap me-2"></i>
              作業粒度設定
            </h6>
            <span v-if="granularityModified" class="badge bg-warning text-dark">変更あり</span>
          </div>
          <div class="card-body">
            <GranularityTable
              ref="granularityRef"
              :readonly="readonly"
              @granularity-removed="handleGranularityRemoved"
              @granularity-changed="handleGranularityChanged"
            />
          </div>
        </div>
      </div>

      <!-- 作業工数設定 -->
      <div class="col-12 col-lg-6">
        <div class="card h-100" :class="{ 'border-primary': stageModified }">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h6 class="mb-0">
              <i class="bi bi-speedometer2 me-2"></i>
              作業工数設定
            </h6>
            <div class="d-flex gap-2 align-items-center">
              <span v-if="stageModified" class="badge bg-warning text-dark">変更あり</span>
              <button
                v-if="!readonly"
                class="btn btn-outline-secondary btn-sm"
                type="button"
                :disabled="isSaving"
                @click="resetStageColors"
              >
                <i class="bi bi-palette me-1"></i>
                色再設定
              </button>
            </div>
          </div>
          <div class="card-body">
            <StageWorkloadEditor
              ref="stageEditorRef"
              :readonly="readonly"
              @stage-changed="handleStageChanged"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 保存ボタン（編集可能な場合のみ） -->
    <div v-if="!readonly" class="d-flex justify-content-end gap-2 mt-4">
      <button
        class="btn btn-outline-secondary"
        type="button"
        :disabled="isSaving || !hasChanges"
        @click="resetChanges"
      >
        <i class="bi bi-arrow-clockwise me-1"></i>
        リセット
      </button>
      <button
        class="btn btn-primary"
        type="button"
        :disabled="isSaving || !canSave"
        @click="saveAll"
      >
        <i class="bi bi-check-lg me-1"></i>
        {{ isSaving ? "保存中..." : "設定を保存" }}
      </button>
    </div>

    <!-- 変更状況表示 -->
    <div v-if="!readonly && hasChanges" class="mt-3">
      <div class="alert alert-info d-flex align-items-center">
        <i class="bi bi-info-circle me-2"></i>
        <span>設定に変更があります。保存ボタンを押して変更を適用してください。</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import GranularityTable from '@/modules/settings/components/GranularityTable.vue';
import StageWorkloadEditor from '@/modules/settings/components/StageWorkloadEditor.vue';

interface GranularityTableExposed {
  save: () => Promise<void>;
  isSaving: () => boolean;
  canSave: () => boolean;
}

interface StageWorkloadEditorExposed {
  save: () => Promise<void>;
  isSaving: () => boolean;
  canSave: () => boolean;
  resetColors: () => void;
  removeGranularityEntries: (granularityId: string) => void;
  syncWithGranularities: () => void;
}

interface Props {
  readonly?: boolean;
}

interface Emits {
  (e: 'granularity-changed'): void;
  (e: 'stage-changed'): void;
  (e: 'settings-saved'): void;
}

withDefaults(defineProps<Props>(), {
  readonly: false,
});

const emit = defineEmits<Emits>();

const granularityRef = ref<GranularityTableExposed | null>(null);
const stageEditorRef = ref<StageWorkloadEditorExposed | null>(null);

// 変更状態の追跡
const granularityModified = ref(false);
const stageModified = ref(false);

// 保存状態の計算
const isSaving = computed(() =>
  (granularityRef.value?.isSaving() ?? false) ||
  (stageEditorRef.value?.isSaving() ?? false)
);

const canSave = computed(() =>
  (granularityRef.value?.canSave() ?? false) ||
  (stageEditorRef.value?.canSave() ?? false)
);

const hasChanges = computed(() => granularityModified.value || stageModified.value);

// イベントハンドラー
const handleGranularityRemoved = (granularityId: string) => {
  // StageWorkloadEditorに粒度削除を通知
  stageEditorRef.value?.removeGranularityEntries(granularityId);
  granularityModified.value = true;
  emit('granularity-changed');
};

const handleGranularityChanged = () => {
  // StageWorkloadEditorに粒度変更を反映
  stageEditorRef.value?.syncWithGranularities();
  granularityModified.value = true;
  emit('granularity-changed');
};

const handleStageChanged = () => {
  stageModified.value = true;
  emit('stage-changed');
};

const resetStageColors = () => {
  stageEditorRef.value?.resetColors();
  stageModified.value = true;
};

const resetChanges = () => {
  granularityModified.value = false;
  stageModified.value = false;
  // コンポーネントのリセット処理をここに追加
  // （実際の実装では各コンポーネントにリセットメソッドが必要）
};

const saveAll = async () => {
  const promises: Promise<void>[] = [];

  // 粒度設定に変更がある場合
  if (granularityRef.value?.canSave()) {
    promises.push(granularityRef.value.save());
  }

  // 工数設定に変更がある場合
  if (stageEditorRef.value?.canSave()) {
    promises.push(stageEditorRef.value.save());
  }

  if (promises.length > 0) {
    try {
      await Promise.all(promises);
      granularityModified.value = false;
      stageModified.value = false;
      emit('settings-saved');
      console.log('全設定の保存が完了しました');
    } catch (error) {
      console.error('設定保存エラー:', error);
      throw error;
    }
  }
};

// 外部から呼び出し可能なメソッドを公開
defineExpose({
  save: saveAll,
  isSaving: () => isSaving.value,
  canSave: () => canSave.value,
  hasChanges: () => hasChanges.value,
  resetChanges,
});
</script>

<style scoped>
.card.border-primary {
  border-width: 2px;
}

.badge {
  font-size: 0.7rem;
}

.alert {
  border: none;
  border-radius: 0.375rem;
  background-color: rgba(13, 110, 253, 0.1);
}
</style>
