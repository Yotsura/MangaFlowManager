<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { storeToRefs } from "pinia";

import { useAuthStore } from "@/store/authStore";
import { useSettingsStore } from "@/store/settingsStore";
import { generateId } from "@/utils/id";

type FieldError = Partial<Record<"label" | "weight" | "defaultCount", string>>;

interface EditableGranularity {
  id: string;
  label: string;
  weight: string;
  defaultCount: string;
}

const authStore = useAuthStore();
const settingsStore = useSettingsStore();

const { user } = storeToRefs(authStore);
const { granularities, loadingGranularities, savingGranularities, granularitiesLoaded, granularitiesLoadError, granularitiesSaveError } = storeToRefs(settingsStore);

const userId = computed(() => user.value?.uid ?? null);

const editableRows = ref<EditableGranularity[]>([]);

const newGranularity = reactive({
  label: "",
  weight: "1",
  defaultCount: "1",
});

const saved = ref(false);
const saveAttempted = ref(false);
const touched = ref(false);
const isSyncingFromStore = ref(false);
const newRowAttempted = ref(false);
const isAddingNew = ref(false);

const isLoading = computed(() => loadingGranularities.value && !granularitiesLoaded.value);
const isSaving = computed(() => savingGranularities.value);

const mapToEditable = (items: typeof granularities.value): EditableGranularity[] =>
  items.map((item) => ({
    id: item.id,
    label: item.label,
    weight: item.weight.toString(),
    defaultCount: item.defaultCount.toString(),
  }));

const resetNewGranularity = () => {
  newGranularity.label = "";
  newGranularity.weight = "1";
  newGranularity.defaultCount = "1";
  newRowAttempted.value = false;
};

const ensureLoaded = async () => {
  if (!userId.value) {
    return;
  }

  if (!granularitiesLoaded.value && !loadingGranularities.value) {
    await settingsStore.fetchGranularities(userId.value);
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
    await settingsStore.fetchGranularities(next);
  }
});

watch(
  granularities,
  (next) => {
    isSyncingFromStore.value = true;
    editableRows.value = mapToEditable(next);
    saved.value = false;
    saveAttempted.value = false;
    touched.value = false;
    newRowAttempted.value = false;
    isAddingNew.value = false;
    isSyncingFromStore.value = false;
  },
  { immediate: true },
);

watch(
  editableRows,
  () => {
    if (isSyncingFromStore.value) {
      return;
    }
    touched.value = true;
    saved.value = false;
  },
  { deep: true },
);

const setRowError = (map: Map<string, FieldError>, id: string, field: keyof FieldError, message: string) => {
  const entry = map.get(id) ?? {};
  entry[field] = message;
  map.set(id, entry);
};

const rowErrors = computed(() => {
  const errors = new Map<string, FieldError>();
  const labelCounts = new Map<string, number>();

  editableRows.value.forEach((row) => {
    const trimmedLabel = row.label.trim();
    const weightNumber = Number(row.weight);

    if (!trimmedLabel) {
      setRowError(errors, row.id, "label", "作業粒度を入力してください。");
    }
    if (row.weight === "" || Number.isNaN(weightNumber)) {
      setRowError(errors, row.id, "weight", "比重は数値で入力してください。");
    } else if (!Number.isInteger(weightNumber) || weightNumber <= 0) {
      setRowError(errors, row.id, "weight", "比重は1以上の整数で入力してください。");
    }

    if (trimmedLabel) {
      labelCounts.set(trimmedLabel, (labelCounts.get(trimmedLabel) ?? 0) + 1);
    }
  });

  editableRows.value.forEach((row) => {
    const trimmedLabel = row.label.trim();
    if (trimmedLabel && (labelCounts.get(trimmedLabel) ?? 0) > 1) {
      setRowError(errors, row.id, "label", "同じ作業粒度が複数あります。");
    }
  });

  return errors;
});

const hasErrors = computed(() => Array.from(rowErrors.value.values()).some((entry) => Object.keys(entry).length > 0));

const canSave = computed(() => !isSaving.value && editableRows.value.length > 0 && !hasErrors.value);

const firstErrorMessage = computed(() => {
  for (const entry of rowErrors.value.values()) {
    const message = entry.label ?? entry.weight;
    if (message) {
      return message;
    }
  }
  return null;
});

const hasTouchedNewRow = computed(() => isAddingNew.value && (newRowAttempted.value || !!newGranularity.label || newGranularity.weight !== "1"));

const newRowValidationMessage = computed(() => {
  const trimmedLabel = newGranularity.label.trim();
  const weightNumber = Number(newGranularity.weight);

  if (!trimmedLabel) {
    return "作業粒度を入力してください。";
  }
  if (newGranularity.weight === "" || Number.isNaN(weightNumber)) {
    return "比重は数値で入力してください。";
  }
  if (!Number.isInteger(weightNumber) || weightNumber <= 0) {
    return "比重は1以上の整数で入力してください。";
  }

  const existingLabels = editableRows.value.map((row) => row.label.trim());
  if (existingLabels.includes(trimmedLabel)) {
    return "同じ作業粒度が既に存在します。";
  }

  return null;
});

const openNewGranularityForm = () => {
  if (isSaving.value || isAddingNew.value) {
    return;
  }

  resetNewGranularity();
  isAddingNew.value = true;
};

const cancelNewGranularity = () => {
  resetNewGranularity();
  isAddingNew.value = false;
};

const submitNewGranularity = () => {
  newRowAttempted.value = true;

  if (newRowValidationMessage.value) {
    return;
  }

  editableRows.value = [
    ...editableRows.value,
    {
      id: generateId(),
      label: newGranularity.label.trim(),
      weight: Number(newGranularity.weight).toString(),
      defaultCount: Number(newGranularity.defaultCount).toString(),
    },
  ];

  touched.value = true;
  saved.value = false;
  resetNewGranularity();
  isAddingNew.value = false;
};

interface Emits {
  (event: "granularity-removed", granularityId: string): void;
}

const emit = defineEmits<Emits>();

const removeRow = (id: string) => {
  editableRows.value = editableRows.value.filter((row) => row.id !== id);
  touched.value = true;
  saved.value = false;

  // 削除された粒度IDをイベントで通知
  emit("granularity-removed", id);
};

const getFieldError = (id: string, field: keyof FieldError) => rowErrors.value.get(id)?.[field] ?? null;

const handleSave = async () => {
  saveAttempted.value = true;

  if (!userId.value || hasErrors.value) {
    return;
  }

  const payload = editableRows.value.map((row) => ({
    id: row.id,
    label: row.label.trim(),
    weight: Number(row.weight),
    defaultCount: Number(row.defaultCount),
  }));

  try {
    await settingsStore.saveGranularities(userId.value, payload);
    saved.value = true;
    saveAttempted.value = false;
    touched.value = false;
  } catch (error) {
    console.error(error);
  }
};

defineExpose({
  save: handleSave,
  isSaving: () => isSaving.value,
  canSave: () => canSave.value,
});
</script>

<template>
  <div class="granularity-table">
    <div v-if="isLoading" class="alert alert-info" role="status">作業粒度を読み込み中です...</div>
    <div v-else-if="granularitiesLoadError" class="alert alert-danger" role="alert">
      {{ granularitiesLoadError }}
    </div>
    <div v-else>
      <div class="table-responsive">
        <table class="table align-middle mb-0">
          <thead>
            <tr>
              <th scope="col" class="w-5">#</th>
              <th scope="col" class="w-20">作業粒度</th>
              <th scope="col" class="w-5">比重</th>
              <th scope="col" class="w-5">デフォルト配置数</th>
              <th scope="col" class="w-55 text-end text-nowrap">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="editableRows.length === 0">
              <td colspan="5" class="text-muted text-center py-4">作業粒度がまだ登録されていません。</td>
            </tr>
            <tr v-for="(row, index) in editableRows" :key="row.id">
              <td>
                <span class="fw-semibold text-muted">#{{ index + 1 }}</span>
              </td>
              <td>
                <input v-model="row.label" :class="['form-control', { 'is-invalid': getFieldError(row.id, 'label') }]" type="text" placeholder="例: ページ単位" :disabled="isSaving" />
              </td>
              <td>
                <input v-model="row.weight" :class="['form-control', { 'is-invalid': getFieldError(row.id, 'weight') }]" type="number" min="1" step="1" :disabled="isSaving" />
              </td>
              <td>
                <input v-model="row.defaultCount" :class="['form-control', { 'is-invalid': getFieldError(row.id, 'defaultCount') }]" type="number" min="1" step="1" :disabled="isSaving" />
              </td>
              <td class="text-end text-nowrap">
                <button class="btn btn-outline-danger btn-sm" type="button" :disabled="isSaving" @click="removeRow(row.id)">削除</button>
              </td>
            </tr>
            <tr v-if="isAddingNew" class="table-light">
              <td>
                <span class="fw-semibold text-muted">#{{ editableRows.length + 1 }}</span>
              </td>
              <td>
                <input
                  v-model="newGranularity.label"
                  :class="['form-control', { 'is-invalid': hasTouchedNewRow && !!newRowValidationMessage }]"
                  type="text"
                  placeholder="例: カット単位"
                  :disabled="isSaving"
                />
              </td>
              <td>
                <input v-model="newGranularity.weight" :class="['form-control', { 'is-invalid': hasTouchedNewRow && !!newRowValidationMessage }]" type="number" min="1" step="1" :disabled="isSaving" />
              </td>
              <td>
                <input v-model="newGranularity.defaultCount" :class="['form-control', { 'is-invalid': hasTouchedNewRow && !!newRowValidationMessage }]" type="number" min="1" step="1" :disabled="isSaving" />
              </td>
              <td class="text-end text-nowrap">
                <div class="d-flex justify-content-end gap-2">
                  <button class="btn btn-outline-secondary btn-sm" type="button" :disabled="isSaving" @click="cancelNewGranularity">キャンセル</button>
                  <button class="btn btn-primary btn-sm" type="button" :disabled="isSaving" @click="submitNewGranularity">追加</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="table-footer d-flex flex-column flex-md-row align-items-start align-items-md-center gap-3 mt-4">
        <button class="btn btn-outline-secondary" type="button" :disabled="isSaving || isAddingNew" @click="openNewGranularityForm">新規作業粒度追加</button>

        <div class="flex-grow-1">
          <p v-if="(saveAttempted || touched) && hasErrors && firstErrorMessage" class="text-danger small mb-0">
            {{ firstErrorMessage }}
          </p>
          <p v-else-if="isAddingNew && hasTouchedNewRow && newRowValidationMessage" class="text-danger small mb-0">
            {{ newRowValidationMessage }}
          </p>
          <p v-else-if="granularitiesSaveError" class="text-danger small mb-0">{{ granularitiesSaveError }}</p>
          <p v-else-if="saved" class="text-success small mb-0">保存しました。</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.table td,
.table th {
  vertical-align: middle;
}

.table tbody tr.table-light td {
  border-bottom-width: 0;
}

.table tbody tr.table-light input {
  background-color: #fff;
}

.is-invalid {
  border-color: #dc3545;
}

.table-footer {
  justify-content: flex-start;
}
</style>
