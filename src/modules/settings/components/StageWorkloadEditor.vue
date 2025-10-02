<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";

import { useAuthStore } from "@/store/authStore";
import { useSettingsStore } from "@/store/settingsStore";

interface EditableEntry {
  granularityId: string;
  hours: string;
}

interface EditableStage {
  id: number;
  label: string;
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
  if (!stageWorkloadsLoaded.value || granularities.value.length === 0) {
    return;
  }

  const mapped: EditableStage[] = stageWorkloads.value.map((stage, index) => ({
    id: index + 1,
    label: stage.label,
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

watch([stageWorkloads, granularities], () => {
  syncEditableStages();
});

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
  editableStages.value = [
    ...editableStages.value,
    {
      id: nextId,
      label: "",
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

const handleSave = async () => {
  saveAttempted.value = true;

  if (!userId.value) {
    return;
  }

  if (hasErrors.value) {
    return;
  }

  const payload = editableStages.value.map((stage, index) => ({
    id: index + 1,
    label: stage.label.trim(),
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
            <div class="d-flex flex-column flex-md-row align-items-md-center gap-3 mb-3">
              <span class="badge text-bg-secondary fs-6">#{{ stage.id }}</span>
              <div class="flex-grow-1">
                <input v-model="stage.label" :class="['form-control', { 'is-invalid': showValidation && getStageError(stage.id)?.label }]" type="text" placeholder="例: ネーム" :disabled="isSaving" />
                <div v-if="showValidation && getStageError(stage.id)?.label" class="invalid-feedback d-block">
                  {{ getStageError(stage.id)?.label }}
                </div>
              </div>
              <button class="btn btn-outline-danger" type="button" :disabled="isSaving" @click="removeStage(stage.id)">削除</button>
            </div>

            <div class="row g-3">
              <div v-for="entry in stage.entries" :key="`${stage.id}-${entry.granularityId}`" class="col-12 col-sm-6 col-lg-4">
                <label class="form-label mb-1">{{ granularityLabel(entry.granularityId) }}</label>
                <div class="input-group">
                  <input v-model="entry.hours"
                    :class="['form-control', { 'is-invalid': showValidation && getEntryError(stage.id, entry.granularityId) }]"
                    type="number" min="0" step="0.1" :disabled="isSaving"/>
                  <span class="input-group-text">h</span>
                </div>
                <div v-if="showValidation && getEntryError(stage.id, entry.granularityId)" class="invalid-feedback d-block">
                  {{ getEntryError(stage.id, entry.granularityId) }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="d-flex flex-column flex-md-row align-items-md-center gap-3 mt-4">
          <button class="btn btn-outline-secondary" type="button" :disabled="isSaving || granularities.length === 0" @click="addStage">新規作業段階追加</button>

          <div class="flex-grow-1">
            <p v-if="showValidation && hasErrors && firstErrorMessage" class="text-danger small mb-0">
              {{ firstErrorMessage }}
            </p>
            <p v-else-if="stageWorkloadsSaveError" class="text-danger small mb-0">{{ stageWorkloadsSaveError }}</p>
            <p v-else-if="saved" class="text-success small mb-0">保存しました。</p>
          </div>

          <button class="btn btn-primary ms-md-auto" type="button" :disabled="isSaving || editableStages.length === 0" @click="handleSave">
            {{ isSaving ? "保存中..." : "設定を保存" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stage-workload-editor .card {
  border: none;
}

.stage-workload-editor .card-body {
  padding: 1.5rem;
}

.stage-workload-editor .badge {
  min-width: 3rem;
  justify-content: center;
}

@media (max-width: 575.98px) {
  .stage-workload-editor .card-body {
    padding: 1.25rem;
  }
}
</style>
