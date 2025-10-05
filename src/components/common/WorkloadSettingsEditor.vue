<template>
  <div class="workload-settings-editor">
    <h5 v-if="isWorkMode" class="mb-4">作品固有設定</h5>

    <div class="row g-4">
      <!-- 作業粒度設定 -->
      <div class="col-12 col-lg-6">
        <div class="card h-100">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h6 class="mb-0">
              <i class="bi bi-grid-3x3-gap me-2"></i>
              作業粒度設定
            </h6>
            <span v-if="granularityTouched" class="badge bg-warning text-dark">変更あり</span>
          </div>
          <div class="card-body">
            <div v-if="granularityLoadError" class="alert alert-danger">
              作業粒度の読み込みに失敗しました: {{ granularityLoadError }}
            </div>
            <div v-else-if="granularityLoading" class="alert alert-info">
              作業粒度を読み込み中です...
            </div>
            <div v-else>
              <!-- 既存の粒度テーブル -->
              <div class="table-responsive">
                <table class="table table-sm">
                  <thead>
                    <tr>
                      <th>作業粒度</th>
                      <th>比重</th>
                      <th>デフォルト個数</th>
                      <th class="text-end">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="granularity in editableGranularities" :key="granularity.id">
                      <td>
                        <input
                          v-model="granularity.label"
                          :class="['form-control form-control-sm', { 'is-invalid': getGranularityError(granularity.id)?.label }]"
                          type="text"
                          :disabled="isSaving"
                          @input="handleGranularityChange"
                        />
                        <div v-if="getGranularityError(granularity.id)?.label" class="invalid-feedback">
                          {{ getGranularityError(granularity.id)?.label }}
                        </div>
                      </td>
                      <td style="width: 120px;">
                        <input
                          v-model="granularity.weight"
                          :class="['form-control form-control-sm', { 'is-invalid': getGranularityError(granularity.id)?.weight }]"
                          type="number"
                          min="1"
                          step="1"
                          :disabled="isSaving"
                          @input="handleGranularityChange"
                        />
                        <div v-if="getGranularityError(granularity.id)?.weight" class="invalid-feedback">
                          {{ getGranularityError(granularity.id)?.weight }}
                        </div>
                      </td>
                      <td style="width: 140px;">
                        <input
                          v-model="granularity.defaultCount"
                          :class="['form-control form-control-sm', { 'is-invalid': getGranularityError(granularity.id)?.defaultCount }]"
                          type="number"
                          min="1"
                          step="1"
                          :disabled="isSaving"
                          @input="handleGranularityChange"
                        />
                        <div v-if="getGranularityError(granularity.id)?.defaultCount" class="invalid-feedback">
                          {{ getGranularityError(granularity.id)?.defaultCount }}
                        </div>
                      </td>
                      <td class="text-end">
                        <button
                          class="btn btn-outline-danger btn-sm"
                          type="button"
                          :disabled="isSaving"
                          @click="removeGranularity(granularity.id)"
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <button
                class="btn btn-outline-secondary"
                type="button"
                :disabled="isSaving"
                @click="addGranularity"
              >
                新規作業粒度追加
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 作業工数設定 -->
      <div class="col-12 col-lg-6">
        <div class="card h-100">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h6 class="mb-0">
              <i class="bi bi-speedometer2 me-2"></i>
              作業工数設定
            </h6>
            <div class="d-flex gap-2 align-items-center">
              <span v-if="stageTouched" class="badge bg-warning text-dark">変更あり</span>
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
            <div v-if="stageLoadError" class="alert alert-danger">
              作業段階の読み込みに失敗しました: {{ stageLoadError }}
            </div>
            <div v-else-if="stageLoading || editableGranularities.length === 0" class="alert alert-info">
              {{ editableGranularities.length === 0 ? '作業粒度を先に設定してください' : '作業段階の工数を読み込み中です...' }}
            </div>
            <div v-else>
              <!-- 既存のステージエディター -->
              <div v-for="stage in editableStages" :key="stage.id" class="stage-editor mb-4">
                <div class="d-flex align-items-center gap-3 mb-3">
                  <div class="stage-color-selector">
                    <button
                      :style="{ backgroundColor: stage.color }"
                      class="btn stage-color-button"
                      type="button"
                      :disabled="isSaving"
                      @click="openColorPicker(stage.id)"
                    >
                      #{{ stage.id }}
                    </button>
                    <input
                      v-model="stage.color"
                      type="color"
                      class="stage-color-input"
                      :disabled="isSaving"
                      :ref="(el) => setColorInputRef(stage.id, el as HTMLInputElement | null)"
                      @input="handleStageChange"
                    />
                  </div>

                  <div class="stage-name flex-grow-1">
                    <input
                      v-model="stage.label"
                      :class="['form-control form-control-sm', { 'is-invalid': getStageError(stage.id)?.label }]"
                      type="text"
                      placeholder="例: ネーム"
                      :disabled="isSaving"
                      @input="handleStageChange"
                    />
                    <div v-if="getStageError(stage.id)?.label" class="invalid-feedback">
                      {{ getStageError(stage.id)?.label }}
                    </div>
                  </div>

                  <div class="stage-actions">
                    <button
                      v-if="isWorkMode"
                      class="btn btn-outline-secondary btn-sm"
                      type="button"
                      :disabled="isSaving"
                      @click="applyBulkSetting(stage.id)"
                      title="この段階未満に適用"
                    >
                      一括設定
                    </button>
                    <button
                      class="btn btn-outline-danger btn-sm ms-2"
                      type="button"
                      :disabled="isSaving"
                      @click="removeStage(stage.id)"
                    >
                      削除
                    </button>
                  </div>
                </div>

                <div class="row g-2">
                  <div v-for="entry in stage.entries" :key="`${stage.id}-${entry.granularityId}`" class="col-md-4">
                    <label class="form-label text-muted small">{{ getGranularityLabel(entry.granularityId) }}</label>
                    <div class="input-group input-group-sm">
                      <input
                        v-model="entry.hours"
                        :class="['form-control', { 'is-invalid': getEntryError(stage.id, entry.granularityId) }]"
                        type="number"
                        min="0"
                        step="0.1"
                        :disabled="isSaving"
                        @input="(event) => { updateRelatedEntries(stage.id, entry.granularityId, (event.target as HTMLInputElement)?.value || ''); handleStageChange(); }"
                      />
                      <span class="input-group-text">時間</span>
                    </div>
                    <div v-if="getEntryError(stage.id, entry.granularityId)" class="invalid-feedback d-block">
                      {{ getEntryError(stage.id, entry.granularityId) }}
                    </div>
                  </div>
                </div>
              </div>

              <button
                class="btn btn-outline-secondary"
                type="button"
                :disabled="isSaving || editableGranularities.length === 0"
                @click="addStage"
              >
                新規作業段階追加
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 保存ボタン（編集可能で、かつ作品モードでない場合のみ） -->
    <div v-if="!readonly && !isWorkMode" class="d-flex justify-content-end gap-2 mt-4">
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

    <!-- 変更状況表示（グローバル設定モードのみ） -->
    <div v-if="!readonly && !isWorkMode && hasChanges" class="mt-3">
      <div class="alert alert-info d-flex align-items-center">
        <i class="bi bi-info-circle me-2"></i>
        <span>設定に変更があります。保存ボタンを押して変更を適用してください。</span>
      </div>
    </div>

    <!-- 作品モード用の説明 -->
    <div v-if="isWorkMode" class="text-muted small mt-4 pt-3 border-top">
      <p class="mb-1">※ 作品固有設定を変更すると、この作品のみの表示・計算に影響します。</p>
      <p class="mb-0">※ 変更内容はリアルタイムで反映されます。</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { generateId } from '@/utils/id';
import { getDefaultStageColor, normalizeStageColorValue } from '@/modules/works/utils/stageColor';

interface Props {
  readonly?: boolean;
  // 作品固有設定モード
  workMode?: boolean;
  workGranularities?: Array<{
    id: string;
    label: string;
    weight: number;
    defaultCount: number;
  }>;
  workStageWorkloads?: Array<{
    id: number;
    label: string;
    color: string;
    baseHours: number | null;
  }>;
  // 作品データ（一括段階更新用）
  workData?: {
    id: string;
    units: Array<{
      id: string;
      index: number;
      children?: Array<{
        id: string;
        index: number;
        stageIndex?: number;
      }>;
      stageIndex?: number;
    }>;
  };
}

interface Emits {
  (e: 'settings-saved'): void;
  (e: 'granularity-change', granularities: Array<{
    id: string;
    label: string;
    weight: number;
    defaultCount: number;
  }>): void;
  (e: 'stage-workload-change', stageWorkloads: Array<{
    id: number;
    label: string;
    color: string;
    baseHours: number | null;
  }>): void;
  (e: 'bulk-stage-update', updates: Array<{
    unitId: string;
    newStage: number;
  }>): void;
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
  workMode: false,
  workGranularities: () => [],
  workStageWorkloads: () => [],
  workData: undefined,
});

const emit = defineEmits<Emits>();

const authStore = useAuthStore();
const settingsStore = useSettingsStore();

const { user } = storeToRefs(authStore);
const {
  granularities,
  stageWorkloads,
  loadingGranularities,
  loadingStageWorkloads,
  savingGranularities,
  savingStageWorkloads,
  granularitiesLoaded,
  stageWorkloadsLoaded,
  granularitiesLoadError,
  stageWorkloadsLoadError,
} = storeToRefs(settingsStore);

const userId = computed(() => user.value?.uid ?? null);

// 作業粒度関連の状態
interface EditableGranularity {
  id: string;
  label: string;
  weight: string;
  defaultCount: string;
}

const editableGranularities = ref<EditableGranularity[]>([]);
const granularityTouched = ref(false);
const granularitySaveAttempted = ref(false);

// 作品モードかどうかを判定
const isWorkMode = computed(() => props.workMode);

// 作業工数関連の状態
interface EditableEntry {
  granularityId: string;
  hours: string;
}

interface EditableStage {
  id: number;
  label: string;
  color: string;
  entries: EditableEntry[];
  baseHours: number | null;
}

const editableStages = ref<EditableStage[]>([]);
const stageTouched = ref(false);
const stageSaveAttempted = ref(false);
const colorInputRefs = new Map<number, HTMLInputElement>();

// 計算プロパティ
const granularityLoading = computed(() => loadingGranularities.value || !granularitiesLoaded.value);
const stageLoading = computed(() => loadingStageWorkloads.value || !stageWorkloadsLoaded.value);
const granularityLoadError = computed(() => granularitiesLoadError.value);
const stageLoadError = computed(() => stageWorkloadsLoadError.value);
const isSaving = computed(() => savingGranularities.value || savingStageWorkloads.value);
const hasChanges = computed(() => granularityTouched.value || stageTouched.value);
const canSave = computed(() => hasChanges.value && !granularityErrors.value.size && !stageErrors.value.size);

// 初期化
const ensureLoaded = async () => {
  if (!userId.value || isWorkMode.value) return;

  if (!granularitiesLoaded.value && !loadingGranularities.value) {
    await settingsStore.fetchGranularities(userId.value);
  }

  if (!stageWorkloadsLoaded.value && !loadingStageWorkloads.value) {
    await settingsStore.fetchStageWorkloads(userId.value);
  }
};

onMounted(async () => {
  if (!user.value && !isWorkMode.value) {
    await authStore.ensureInitialized();
  }
  if (!isWorkMode.value) {
    await ensureLoaded();
  }
});

watch(userId, async (next, prev) => {
  if (next && next !== prev && !isWorkMode.value) {
    await ensureLoaded();
  }
});

// 作業粒度の同期
const syncGranularities = () => {
  if (isWorkMode.value) {
    // 作品モードの場合、propsから初期化
    editableGranularities.value = props.workGranularities.map(g => ({
      id: g.id,
      label: g.label,
      weight: g.weight.toString(),
      defaultCount: g.defaultCount.toString(),
    }));
  } else {
    // グローバル設定モードの場合、storeから初期化
    if (!granularitiesLoaded.value) return;
    editableGranularities.value = granularities.value.map(g => ({
      id: g.id,
      label: g.label,
      weight: g.weight.toString(),
      defaultCount: g.defaultCount.toString(),
    }));
  }

  granularityTouched.value = false;
  granularitySaveAttempted.value = false;
};

// 作品モード用のwatcher
watch(() => props.workGranularities, syncGranularities, { immediate: true, deep: true });
// グローバル設定モード用のwatcher
watch(granularities, () => {
  if (!isWorkMode.value) {
    syncGranularities();
  }
}, { immediate: true });

// 作業工数の同期
const formatHours = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "";
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toString();
};

const syncStages = () => {
  if (editableGranularities.value.length === 0) return;

  let sourceStages: Array<{
    id?: number;
    label: string;
    color: string;
    baseHours: number | null;
  }> = [];

  if (isWorkMode.value) {
    // 作品モードの場合、propsから初期化
    sourceStages = props.workStageWorkloads;
  } else {
    // グローバル設定モードの場合、storeから初期化
    if (!stageWorkloadsLoaded.value) return;
    sourceStages = stageWorkloads.value;
  }

  const totalStages = sourceStages.length;
  const lowestGranularity = editableGranularities.value.reduce((min, current) =>
    Number(current.weight) < Number(min.weight) ? current : min
  );

  editableStages.value = sourceStages.map((stage, index) => ({
    id: stage.id ?? (index + 1),
    label: stage.label,
    color: normalizeStageColorValue(stage.color, index, totalStages),
    baseHours: stage.baseHours,
    entries: editableGranularities.value.map((granularity) => {
      let hours: number | null = null;
      if (stage.baseHours !== null && lowestGranularity) {
        const ratio = Number(granularity.weight) / Number(lowestGranularity.weight);
        hours = stage.baseHours * ratio;
      }
      return {
        granularityId: granularity.id,
        hours: formatHours(hours),
      };
    }),
  }));

  stageTouched.value = false;
  stageSaveAttempted.value = false;
};

// 作品モード用のwatcher
watch(() => props.workStageWorkloads, syncStages, { deep: true, immediate: true });
// グローバル設定モード用のwatcher
watch([stageWorkloads, editableGranularities], () => {
  if (!isWorkMode.value) {
    syncStages();
  }
}, { deep: true, immediate: true });

// 作業粒度のバリデーション
interface GranularityFieldError {
  label?: string;
  weight?: string;
  defaultCount?: string;
}

const granularityErrors = computed(() => {
  const errors = new Map<string, GranularityFieldError>();
  const labelCounts = new Map<string, number>();

  // ラベルの重複をチェック
  editableGranularities.value.forEach(g => {
    const trimmed = g.label.trim();
    if (trimmed) {
      labelCounts.set(trimmed, (labelCounts.get(trimmed) || 0) + 1);
    }
  });

  editableGranularities.value.forEach(g => {
    const error: GranularityFieldError = {};
    const trimmed = g.label.trim();

    if (!trimmed) {
      error.label = "作業粒度を入力してください。";
    } else if (labelCounts.get(trimmed)! > 1) {
      error.label = "同じ作業粒度が既に存在します。";
    }

    const weightNum = Number(g.weight);
    if (g.weight === "" || Number.isNaN(weightNum)) {
      error.weight = "比重は数値で入力してください。";
    } else if (!Number.isInteger(weightNum) || weightNum <= 0) {
      error.weight = "比重は1以上の整数で入力してください。";
    }

    const countNum = Number(g.defaultCount);
    if (g.defaultCount === "" || Number.isNaN(countNum)) {
      error.defaultCount = "デフォルト個数は数値で入力してください。";
    } else if (!Number.isInteger(countNum) || countNum <= 0) {
      error.defaultCount = "デフォルト個数は1以上の整数で入力してください。";
    }

    if (Object.keys(error).length > 0) {
      errors.set(g.id, error);
    }
  });

  return errors;
});

const getGranularityError = (id: string) => granularityErrors.value.get(id);

// 作業工数のバリデーション
interface StageError {
  label?: string;
  entryErrors: Map<string, string>;
}

const stageErrors = computed(() => {
  const errors = new Map<number, StageError>();
  const labelCounts = new Map<string, number>();

  // ラベルの重複をチェック
  editableStages.value.forEach(s => {
    const trimmed = s.label.trim();
    if (trimmed) {
      labelCounts.set(trimmed, (labelCounts.get(trimmed) || 0) + 1);
    }
  });

  editableStages.value.forEach(stage => {
    const stageError: StageError = { entryErrors: new Map() };
    const trimmed = stage.label.trim();

    if (!trimmed) {
      stageError.label = "作業段階名を入力してください。";
    } else if (labelCounts.get(trimmed)! > 1) {
      stageError.label = "同じ作業段階名が既に存在します。";
    }

    stage.entries.forEach(entry => {
      if (entry.hours !== "") {
        const hoursNum = Number(entry.hours);
        if (Number.isNaN(hoursNum) || hoursNum < 0) {
          stageError.entryErrors.set(entry.granularityId, "0以上の数値を入力してください。");
        }
      }
    });

    if (stageError.label || stageError.entryErrors.size > 0) {
      errors.set(stage.id, stageError);
    }
  });

  return errors;
});

const getStageError = (id: number) => stageErrors.value.get(id);
const getEntryError = (stageId: number, granularityId: string) =>
  stageErrors.value.get(stageId)?.entryErrors.get(granularityId);

// ユーティリティ関数
const getGranularityLabel = (granularityId: string) => {
  return editableGranularities.value.find(g => g.id === granularityId)?.label || '';
};

const setColorInputRef = (stageId: number, el: HTMLInputElement | null) => {
  if (el) {
    colorInputRefs.set(stageId, el);
  } else {
    colorInputRefs.delete(stageId);
  }
};

const openColorPicker = (stageId: number) => {
  const input = colorInputRefs.get(stageId);
  if (input && !isSaving.value) {
    input.click();
  }
};

// イベントハンドラー
const handleGranularityChange = () => {
  granularityTouched.value = true;
  // 粒度が変更されたら、既存のステージを同期
  syncStagesWithGranularities();

  // 作品モードの場合、親コンポーネントに変更を通知
  if (isWorkMode.value) {
    const granularities = editableGranularities.value.map(g => ({
      id: g.id,
      label: g.label.trim(),
      weight: Number(g.weight),
      defaultCount: Number(g.defaultCount),
    }));
    emit('granularity-change', granularities);
  }
};

const handleStageChange = () => {
  stageTouched.value = true;

  // 作品モードの場合、親コンポーネントに変更を通知
  if (isWorkMode.value) {
    const lowestGranularity = editableGranularities.value.reduce((min, current) =>
      Number(current.weight) < Number(min.weight) ? current : min
    );

    const stageWorkloads = editableStages.value.map(stage => {
      const lowestEntry = stage.entries.find(entry => entry.granularityId === lowestGranularity.id);
      const baseHours = lowestEntry && lowestEntry.hours !== "" ? Number(lowestEntry.hours) : null;

      return {
        id: stage.id,
        label: stage.label.trim(),
        color: stage.color,
        baseHours,
      };
    });
    emit('stage-workload-change', stageWorkloads);
  }
};

const syncStagesWithGranularities = () => {
  editableStages.value.forEach(stage => {
    const existingEntries = new Map(
      stage.entries.map(entry => [entry.granularityId, entry])
    );

    stage.entries = editableGranularities.value.map(granularity => {
      const existingEntry = existingEntries.get(granularity.id);
      return existingEntry || {
        granularityId: granularity.id,
        hours: "",
      };
    });
  });
  stageTouched.value = true;
};

// 作業粒度の操作
const addGranularity = () => {
  if (isSaving.value) return;

  const newId = generateId();
  const nextNumber = editableGranularities.value.length + 1;

  editableGranularities.value.push({
    id: newId,
    label: `粒度${nextNumber}`,
    weight: '1',
    defaultCount: '1',
  });

  // 既存のステージに新しい粒度のエントリを追加
  editableStages.value.forEach(stage => {
    stage.entries.push({
      granularityId: newId,
      hours: "",
    });
  });

  granularityTouched.value = true;
  stageTouched.value = true;
};

const removeGranularity = (granularityId: string) => {
  if (isSaving.value) return;

  editableGranularities.value = editableGranularities.value.filter(g => g.id !== granularityId);

  // 全ステージから該当する粒度のエントリを削除
  editableStages.value.forEach(stage => {
    stage.entries = stage.entries.filter(entry => entry.granularityId !== granularityId);
  });

  granularityTouched.value = true;
  stageTouched.value = true;
};

// 作業工数の操作
const addStage = () => {
  if (editableGranularities.value.length === 0 || isSaving.value) return;

  const nextId = editableStages.value.length + 1;
  const totalStages = nextId;
  const color = getDefaultStageColor(totalStages - 1, totalStages);

  editableStages.value.push({
    id: nextId,
    label: `ステージ${nextId}`,
    color,
    baseHours: null,
    entries: editableGranularities.value.map(granularity => ({
      granularityId: granularity.id,
      hours: "",
    })),
  });

  stageTouched.value = true;
};

const removeStage = (id: number) => {
  if (isSaving.value) return;

  editableStages.value = editableStages.value
    .filter(stage => stage.id !== id)
    .map((stage, index) => ({
      ...stage,
      id: index + 1,
    }));

  stageTouched.value = true;
};

const updateRelatedEntries = (stageId: number, changedGranularityId: string, newValue: string) => {
  if (editableGranularities.value.length === 0) return;

  const stage = editableStages.value.find(s => s.id === stageId);
  if (!stage) return;

  const changedGranularity = editableGranularities.value.find(g => g.id === changedGranularityId);
  if (!changedGranularity) return;

  const newHours = Number(newValue);
  if (Number.isNaN(newHours) || newHours <= 0) return;

  const changedWeight = Number(changedGranularity.weight);

  stage.entries.forEach(entry => {
    if (entry.granularityId === changedGranularityId) return;

    const granularity = editableGranularities.value.find(g => g.id === entry.granularityId);
    if (!granularity) return;

    const ratio = Number(granularity.weight) / changedWeight;
    const calculatedHours = newHours * ratio;
    const rounded = Math.round(calculatedHours * 10) / 10;

    entry.hours = Number.isInteger(rounded) ? String(rounded) : rounded.toString();
  });
};

const applyBulkSetting = (targetStageId: number) => {
  if (isSaving.value || !isWorkMode.value || !props.workData) return;

  // 階層構造をフラットにして最下位の作業単位を取得
  const flattenUnits = (units: typeof props.workData.units): Array<{ id: string; stageIndex: number }> => {
    const result: Array<{ id: string; stageIndex: number }> = [];

    for (const unit of units) {
      if (unit.stageIndex !== undefined) {
        // 最下位の単位（stageIndexを持つ）
        result.push({ id: unit.id, stageIndex: unit.stageIndex });
      } else if (unit.children) {
        // 中間層の場合、子を再帰的に処理
        result.push(...flattenUnits(unit.children));
      }
    }

    return result;
  };

  const allLeafUnits = flattenUnits(props.workData.units);
  let unitsToUpdate: Array<{ id: string; stageIndex: number }>;
  let confirmMessage: string;
  let newStageIndex: number;

  if (targetStageId === 1) {
    // 最初の段階の場合：すべての作業単位を最初の段階に巻き戻す
    unitsToUpdate = allLeafUnits.filter(unit => unit.stageIndex > 0);
    newStageIndex = 0;
    confirmMessage = `すべての作業単位を最初の段階に巻き戻しますか？（${unitsToUpdate.length}個の作業単位が対象）`;
  } else {
    // その他の段階の場合：対象段階未満のものを対象段階に進める
    unitsToUpdate = allLeafUnits.filter(unit => unit.stageIndex < (targetStageId - 1));
    newStageIndex = targetStageId - 1;
    const targetStageName = editableStages.value.find(s => s.id === targetStageId)?.label || `段階${targetStageId}`;
    confirmMessage = `対象段階未満の作業単位を「${targetStageName}」に進めますか？（${unitsToUpdate.length}個の作業単位が対象）`;
  }

  if (unitsToUpdate.length === 0) {
    alert('対象となる作業単位がありません。');
    return;
  }

  // 確認ダイアログ
  if (!confirm(confirmMessage)) {
    return;
  }

  // 一括更新用のデータを作成
  const updates = unitsToUpdate.map(unit => ({
    unitId: unit.id,
    newStage: newStageIndex
  }));

  // 親コンポーネントに一括段階更新を通知
  emit('bulk-stage-update', updates);
};

const resetStageColors = () => {
  editableStages.value.forEach((stage, index) => {
    const totalStages = editableStages.value.length;
    stage.color = getDefaultStageColor(index, totalStages);
  });
  stageTouched.value = true;
};

const resetChanges = () => {
  syncGranularities();
  syncStages();
  granularityTouched.value = false;
  stageTouched.value = false;
};

const saveAll = async () => {
  granularitySaveAttempted.value = true;
  stageSaveAttempted.value = true;

  if (granularityErrors.value.size > 0 || stageErrors.value.size > 0) {
    return;
  }

  // 作品モードの場合は親コンポーネントが保存を処理
  if (isWorkMode.value) {
    // 最終的な変更を通知
    handleGranularityChange();
    handleStageChange();
    granularityTouched.value = false;
    stageTouched.value = false;
    emit('settings-saved');
    return;
  }

  // グローバル設定モードの場合は直接保存
  if (!userId.value) {
    return;
  }

  try {
    const promises: Promise<void>[] = [];

    // 作業粒度を保存
    if (granularityTouched.value) {
      const granularityPayload = editableGranularities.value.map(g => ({
        id: g.id,
        label: g.label.trim(),
        weight: Number(g.weight),
        defaultCount: Number(g.defaultCount),
      }));
      promises.push(settingsStore.saveGranularities(userId.value, granularityPayload));
    }

    // 作業工数を保存
    if (stageTouched.value) {
      const lowestGranularity = editableGranularities.value.reduce((min, current) =>
        Number(current.weight) < Number(min.weight) ? current : min
      );

      const stagePayload = editableStages.value.map((stage, index) => {
        const lowestEntry = stage.entries.find(entry => entry.granularityId === lowestGranularity.id);
        const baseHours = lowestEntry && lowestEntry.hours !== "" ? Number(lowestEntry.hours) : null;

        return {
          id: index + 1,
          label: stage.label.trim(),
          color: stage.color,
          baseHours,
        };
      });
      promises.push(settingsStore.saveStageWorkloads(userId.value, stagePayload));
    }

    if (promises.length > 0) {
      await Promise.all(promises);
      granularityTouched.value = false;
      stageTouched.value = false;
      emit('settings-saved');
    }
  } catch (error) {
    console.error('設定保存エラー:', error);
    throw error;
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
.stage-editor {
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
  padding: 1rem;
  background-color: #f8f9fa;
}

.stage-color-selector {
  position: relative;
}

.stage-color-button {
  width: 50px;
  height: 38px;
  border: 2px solid #dee2e6;
  border-radius: 0.375rem;
  color: white;
  font-weight: bold;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  cursor: pointer;
}

.stage-color-button:hover {
  border-color: #adb5bd;
}

.stage-color-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 50px;
  height: 38px;
  opacity: 0;
  cursor: pointer;
}

.card.border-primary {
  border-width: 2px;
}

.badge {
  font-size: 0.7rem;
}

.alert {
  border: none;
  border-radius: 0.375rem;
}
</style>
