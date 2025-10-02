<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";

import { getDefaultStageColor, normalizeStageColorValue, stageColorFor } from "@/modules/works/utils/stageColor";
import { useAuthStore } from "@/store/authStore";
import { useSettingsStore } from "@/store/settingsStore";

interface EditableEntry {
  granularityId: string;
  hours: string;
}

interface EditableStage {
  id: number;
  label: string;
  color: string;
  entries: EditableEntry[];
}

interface StageError {
  label?: string;
  entryErrors: Map<string, string>;
}

const authStore = useAuthStore();
const settingsStore = useSettingsStore();

const { user } = storeToRefs(authStore);
const {
  granularities,
  stageWorkloads,
  loadingStageWorkloads,
  savingStageWorkloads,
  stageWorkloadsLoaded,
  stageWorkloadsLoadError,
  stageWorkloadsSaveError,
  granularitiesLoaded,
  loadingGranularities,
} = storeToRefs(settingsStore);

const userId = computed(() => user.value?.uid ?? null);

const editableStages = ref<EditableStage[]>([]);
const saved = ref(false);
const touched = ref(false);
const saveAttempted = ref(false);
const isSyncingFromStore = ref(false);
const colorInputRefs = new Map<number, HTMLInputElement>();

const isLoading = computed(() => loadingStageWorkloads.value || !stageWorkloadsLoaded.value);
const isSaving = computed(() => savingStageWorkloads.value);
const showValidation = computed(() => saveAttempted.value);
const weightMap = computed(() => new Map<string, number>(granularities.value.map((granularity) => [granularity.id, granularity.weight])));
const granularityIndexMap = computed(() => {
  const map = new Map<string, number>();
  granularities.value.forEach((granularity, index) => {
    map.set(granularity.id, index + 1);
  });
  return map;
});

const ensureLoaded = async () => {
  if (!userId.value) {
    return;
  }

  if (!granularitiesLoaded.value && !loadingGranularities.value) {
    await settingsStore.fetchGranularities(userId.value);
  }

  if (!stageWorkloadsLoaded.value && !loadingStageWorkloads.value) {
    await settingsStore.fetchStageWorkloads(userId.value);
  }
};

onMounted(async () => {
  if (!user.value) {
    await authStore.ensureInitialized();
  }

  await ensureLoaded();
});

watch(userId, async (next, prev) => {
  if (next && next !== prev) {
    await ensureLoaded();
  }
});

const formatHours = (value: number | null | undefined) => {
  if (value === null || value === undefined) {
    return "";
  }

  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toString();
};

const syncEditableStages = () => {
  if (!stageWorkloadsLoaded.value) {
    return;
  }

  if (granularities.value.length === 0) {
    isSyncingFromStore.value = true;
    editableStages.value = [];
    touched.value = false;
    saveAttempted.value = false;
    nextTick(() => {
      isSyncingFromStore.value = false;
    });
    return;
  }

  const totalStages = stageWorkloads.value.length;

  const mapped: EditableStage[] = stageWorkloads.value.map((stage, index) => ({
    id: index + 1,
    label: stage.label,
    color: normalizeStageColorValue(stage.color, index, totalStages),
    entries: granularities.value.map((granularity) => {
      const entry = stage.entries.find((item) => item.granularityId === granularity.id);
      return {
        granularityId: granularity.id,
        hours: formatHours(entry?.hours ?? null),
      };
    }),
  }));

  isSyncingFromStore.value = true;
  editableStages.value = mapped;
  touched.value = false;
  saveAttempted.value = false;
  nextTick(() => {
    isSyncingFromStore.value = false;
  });
};

watch(
  [stageWorkloads, granularities, stageWorkloadsLoaded],
  () => {
    syncEditableStages();
  },
  { deep: true, immediate: true },
);

watch(
  editableStages,
  () => {
    if (isSyncingFromStore.value) {
      return;
    }

    touched.value = true;
    saved.value = false;
  },
  { deep: true },
);

const addStage = () => {
  if (granularities.value.length === 0 || isSaving.value) {
    return;
  }

  const nextId = editableStages.value.length + 1;
  const totalStages = nextId;
  const color = getDefaultStageColor(totalStages - 1, totalStages);
  editableStages.value = [
    ...editableStages.value,
    {
      id: nextId,
      label: "",
      color,
      entries: granularities.value.map((granularity) => ({
        granularityId: granularity.id,
        hours: "",
      })),
    },
  ];
};

const removeStage = (id: number) => {
  if (isSaving.value) {
    return;
  }

  editableStages.value = editableStages.value
    .filter((stage) => stage.id !== id)
    .map((stage, index) => ({
      ...stage,
      id: index + 1,
    }));
};

const stageErrors = computed(() => {
  const errors = new Map<number, StageError>();

  editableStages.value.forEach((stage) => {
    const entryErrors = new Map<string, string>();

    stage.entries.forEach((entry) => {
      if (entry.hours === "") {
        return;
      }

      const parsed = Number(entry.hours);
      if (Number.isNaN(parsed)) {
        entryErrors.set(entry.granularityId, "数値を入力してください。");
      } else if (parsed < 0) {
        entryErrors.set(entry.granularityId, "0以上の値を入力してください。");
      }
    });

    const trimmedLabel = stage.label.trim();
    const labelError = trimmedLabel ? undefined : "作業段階名を入力してください。";

    if (labelError || entryErrors.size > 0) {
      errors.set(stage.id, {
        label: labelError,
        entryErrors,
      });
    }
  });

  return errors;
});

const hasErrors = computed(() => stageErrors.value.size > 0);

const canSave = computed(() => !isSaving.value && editableStages.value.length > 0 && granularities.value.length > 0 && !hasErrors.value);

const firstErrorMessage = computed(() => {
  for (const stageError of stageErrors.value.values()) {
    if (stageError.label) {
      return stageError.label;
    }

    for (const entryError of stageError.entryErrors.values()) {
      if (entryError) {
        return entryError;
      }
    }
  }

  return null;
});

const getStageError = (stageId: number) => stageErrors.value.get(stageId);
const getEntryError = (stageId: number, granularityId: string) => stageErrors.value.get(stageId)?.entryErrors.get(granularityId) ?? null;

const granularityLabel = (granularityId: string) => {
  const granularity = granularities.value.find((item) => item.id === granularityId);
  return granularity ? granularity.label : "未定義の粒度";
};

const stageCountForColor = () => Math.max(editableStages.value.length || stageWorkloads.value.length || 1, 1);

const resolvedStageColor = (stage: EditableStage) => normalizeStageColorValue(stage.color, stage.id - 1, stageCountForColor());

const stageBadgeStyle = (stage: EditableStage) => {
  const { backgroundColor, textColor } = stageColorFor(stage.id - 1, stageCountForColor(), stage.color);
  return {
    backgroundColor,
    color: textColor,
    borderColor: backgroundColor,
  };
};

const stageColorCode = (stage: EditableStage) => resolvedStageColor(stage).toUpperCase();

const setColorInputRef = (stageId: number, el: HTMLInputElement | null) => {
  if (el) {
    colorInputRefs.set(stageId, el);
  } else {
    colorInputRefs.delete(stageId);
  }
};

const openColorPicker = (stageId: number) => {
  if (isSaving.value) {
    return;
  }
  const input = colorInputRefs.get(stageId);
  if (!input) {
    return;
  }
  const picker = (input as HTMLInputElement & { showPicker?: () => void }).showPicker;
  if (typeof picker === "function") {
    picker.call(input);
  } else {
    input.click();
  }
};

const resetStageColors = () => {
  if (isSaving.value || editableStages.value.length === 0) {
    return;
  }

  const totalStages = editableStages.value.length;
  editableStages.value = editableStages.value.map((stage, index) => ({
    ...stage,
    color: getDefaultStageColor(index, totalStages),
  }));

  touched.value = true;
  saved.value = false;
};

const handleSave = async () => {
  saveAttempted.value = true;

  if (!userId.value) {
    return;
  }

  if (hasErrors.value) {
    return;
  }

  const totalStages = editableStages.value.length;
  const payload = editableStages.value.map((stage, index) => ({
    id: index + 1,
    label: stage.label.trim(),
    color: normalizeStageColorValue(stage.color, index, totalStages),
    entries: stage.entries.map((entry) => ({
      granularityId: entry.granularityId,
      hours: entry.hours === "" ? null : Number(entry.hours),
    })),
  }));

  payload.forEach((stage) => {
    const baseCandidates: number[] = [];

    stage.entries.forEach((entry) => {
      if (entry.hours === null) {
        return;
      }

      const weight = weightMap.value.get(entry.granularityId) ?? 1;
      if (weight <= 0) {
        return;
      }

      baseCandidates.push(entry.hours / weight);
    });

    if (baseCandidates.length === 0) {
      return;
    }

    const base = baseCandidates.reduce((total, value) => total + value, 0) / baseCandidates.length;

    stage.entries.forEach((entry) => {
      if (entry.hours !== null) {
        return;
      }

      const weight = weightMap.value.get(entry.granularityId) ?? 1;
      const estimate = base * weight;
      const rounded = Math.round(estimate * 10) / 10;
      entry.hours = rounded;
    });
  });

  try {
    await settingsStore.saveStageWorkloads(userId.value, payload);
    saved.value = true;
    touched.value = false;
    saveAttempted.value = false;
  } catch (error) {
    console.error(error);
  }
};

const removeGranularityEntries = (granularityId: string) => {
  // 各段階から指定された粒度のエントリを削除
  editableStages.value.forEach(stage => {
    stage.entries = stage.entries.filter(entry => entry.granularityId !== granularityId);
  });

  touched.value = true;
  saved.value = false;
};

defineExpose({
  save: handleSave,
  isSaving: () => isSaving.value,
  canSave: () => canSave.value,
  resetColors: resetStageColors,
  removeGranularityEntries,
});
</script>

<template>
  <div class="stage-workload-editor">
    <div v-if="isLoading" class="alert alert-info" role="status">作業段階の工数を読み込み中です...</div>
    <div v-else-if="stageWorkloadsLoadError" class="alert alert-danger" role="alert">
      {{ stageWorkloadsLoadError }}
    </div>
    <div v-else>
      <div v-if="granularities.length === 0" class="alert alert-warning" role="alert">作業粒度が設定されていません。先に粒度を追加してください。</div>

      <div v-else>
        <div v-if="editableStages.length === 0" class="alert alert-secondary" role="alert">作業段階がまだ登録されていません。下のボタンから追加できます。</div>

        <div v-for="stage in editableStages" :key="stage.id" class="card shadow-sm mb-3">
          <div class="card-body">
            <div class="stage-line">
              <div class="stage-meta">
                <button
                  type="button"
                  class="badge fs-6 stage-index stage-index-button"
                  :class="{ 'stage-index-button--disabled': isSaving }"
                  :style="stageBadgeStyle(stage)"
                  :aria-label="`ステージ${stage.id}のヒートマップカラーを変更`"
                  :disabled="isSaving"
                  @click="openColorPicker(stage.id)"
                >
                  #{{ stage.id }}
                </button>
                <!-- <span class="stage-color-code">{{ stageColorCode(stage) }}</span> -->
                <input
                  v-model="stage.color"
                  type="color"
                  class="stage-color-input"
                  :disabled="isSaving"
                  :aria-label="`ステージ${stage.id}のヒートマップカラー`"
                  :ref="(el) => setColorInputRef(stage.id, el as HTMLInputElement | null)"
                />
              </div>

              <div class="stage-name">
                <input
                  v-model="stage.label"
                  :class="['form-control form-control-sm stage-name-input', { 'is-invalid': showValidation && getStageError(stage.id)?.label }]"
                  type="text"
                  placeholder="例: ネーム"
                  :disabled="isSaving"
                />
                <div v-if="showValidation && getStageError(stage.id)?.label" class="invalid-feedback d-block stage-name-error">
                  {{ getStageError(stage.id)?.label }}
                </div>
              </div>

              <div v-for="entry in stage.entries" :key="`${stage.id}-${entry.granularityId}`" class="stage-entry">
                <span class="stage-entry-label text-muted">{{ granularityLabel(entry.granularityId) }}</span>
                <div class="input-group input-group-sm stage-entry-input">
                  <input
                    v-model="entry.hours"
                    :class="['form-control', { 'is-invalid': showValidation && getEntryError(stage.id, entry.granularityId) }]"
                    type="number"
                    min="0"
                    step="0.1"
                    :disabled="isSaving"
                  />
                  <span class="input-group-text">h</span>
                </div>
                <div v-if="showValidation && getEntryError(stage.id, entry.granularityId)" class="invalid-feedback d-block stage-entry-error">
                  {{ getEntryError(stage.id, entry.granularityId) }}
                </div>
              </div>

              <button class="btn btn-outline-danger stage-remove-btn" type="button" :disabled="isSaving" @click="removeStage(stage.id)">削除</button>
            </div>
          </div>
        </div>

        <div class="editor-footer d-flex flex-column flex-md-row align-items-start align-items-md-center gap-3 mt-4">
          <button class="btn btn-outline-secondary" type="button" :disabled="isSaving || granularities.length === 0" @click="addStage">新規作業段階追加</button>

          <div class="flex-grow-1">
            <p v-if="showValidation && hasErrors && firstErrorMessage" class="text-danger small mb-0">
              {{ firstErrorMessage }}
            </p>
            <p v-else-if="stageWorkloadsSaveError" class="text-danger small mb-0">{{ stageWorkloadsSaveError }}</p>
            <p v-else-if="saved" class="text-success small mb-0">保存しました。</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stage-workload-editor .card {
  border: none;
}

.editor-footer {
  justify-content: flex-start;
}

.stage-workload-editor .card-body {
  padding: 0.5rem;
}

.stage-line {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0.75rem 1rem;
}

.stage-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2rem;
  border: 1px solid transparent;
}

.stage-meta {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 6rem;
  align-items: center;
}

.stage-index-button {
  min-width: 3rem;
  justify-content: center;
  cursor: pointer;
  border: 1px solid transparent;
}

.stage-index-button:focus-visible {
  outline: 2px solid #495057;
  outline-offset: 2px;
}

.stage-index-button--disabled {
  cursor: not-allowed;
  opacity: 0.8;
}

.stage-color-code {
  font-size: 0.75rem;
  font-family: var(--bs-font-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace);
  color: #495057;
}

.stage-color-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}

.stage-name {
  display: flex;
  flex-direction: column;
  min-width: 180px;
  max-width: 260px;
}

.stage-name-input {
  width: 100%;
}

.stage-name-error {
  margin-top: 0.25rem;
}

.stage-entry {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.stage-entry-label {
  white-space: nowrap;
  font-size: 0.875rem;
}

.stage-entry-input {
  width: 7rem;
}

.stage-entry-error {
  flex-basis: 100%;
  margin-top: 0.25rem;
}

.stage-remove-btn {
  margin-left: auto;
}

@media (max-width: 575.98px) {
  .stage-workload-editor .card-body {
    padding: 1.25rem;
  }
}
</style>
