<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { storeToRefs } from "pinia";

import { useAuthStore } from "@/store/authStore";
import { useSettingsStore } from "@/store/settingsStore";
import { generateId } from "@/utils/id";

type FieldError = Partial<Record<"label" | "weight", string>>;

interface EditableGranularity {
  id: string;
  label: string;
  weight: string;
}

const authStore = useAuthStore();
const settingsStore = useSettingsStore();

const { user } = storeToRefs(authStore);
const {
  granularities,
  loadingGranularities,
  savingGranularities,
  granularitiesLoaded,
  granularitiesLoadError,
  granularitiesSaveError,
} = storeToRefs(settingsStore);

const userId = computed(() => user.value?.uid ?? null);

const editableRows = ref<EditableGranularity[]>([]);

const newGranularity = reactive({
  label: "",
  weight: "1",
});

const saved = ref(false);
const saveAttempted = ref(false);
const touched = ref(false);
const isSyncingFromStore = ref(false);
const newRowAttempted = ref(false);

const isLoading = computed(() => loadingGranularities.value && !granularitiesLoaded.value);
const isSaving = computed(() => savingGranularities.value);

const mapToEditable = (items: typeof granularities.value): EditableGranularity[] =>
  items.map((item) => ({
    id: item.id,
    label: item.label,
    weight: item.weight.toString(),
  }));

const resetNewGranularity = () => {
  newGranularity.label = "";
  newGranularity.weight = "1";
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

const firstErrorMessage = computed(() => {
  for (const entry of rowErrors.value.values()) {
    const message = entry.label ?? entry.weight;
    if (message) {
      return message;
    }
  }
  return null;
});

const hasTouchedNewRow = computed(
  () => newRowAttempted.value || !!newGranularity.label || newGranularity.weight !== "1",
);

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

const addRow = () => {
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
    },
  ];

  touched.value = true;
  saved.value = false;
  resetNewGranularity();
};

const removeRow = (id: string) => {
  editableRows.value = editableRows.value.filter((row) => row.id !== id);
  touched.value = true;
  saved.value = false;
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
              <th scope="col" class="w-50">作業粒度</th>
              <th scope="col" class="w-25">デフォルト比重</th>
              <th scope="col" class="w-20 text-end">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="editableRows.length === 0">
              <td colspan="4" class="text-muted text-center py-4">作業粒度がまだ登録されていません。</td>
            </tr>
            <tr v-for="(row, index) in editableRows" :key="row.id">
              <td>
                <span class="fw-semibold text-muted">#{{ index + 1 }}</span>
              </td>
              <td>
                <input
                  v-model="row.label"
                  :class="['form-control', { 'is-invalid': getFieldError(row.id, 'label') } ]"
                  type="text"
                  placeholder="例: ページ単位"
                  :disabled="isSaving"
                />
              </td>
              <td>
                <input
                  v-model="row.weight"
                  :class="['form-control', { 'is-invalid': getFieldError(row.id, 'weight') } ]"
                  type="number"
                  min="1"
                  step="1"
                  :disabled="isSaving"
                />
              </td>
              <td class="text-end">
                <button class="btn btn-outline-danger" type="button" :disabled="isSaving" @click="removeRow(row.id)">
                  削除
                </button>
              </td>
            </tr>
            <tr class="table-light">
              <td><span class="fw-semibold text-muted">#{{ editableRows.length + 1 }}</span></td>
              <td>
                <input
                  v-model="newGranularity.label"
                  :class="['form-control', { 'is-invalid': hasTouchedNewRow && !!newRowValidationMessage } ]"
                  type="text"
                  placeholder="例: カット単位"
                  :disabled="isSaving"
                />
              </td>
              <td>
                <input
                  v-model="newGranularity.weight"
                  :class="['form-control', { 'is-invalid': hasTouchedNewRow && !!newRowValidationMessage } ]"
                  type="number"
                  min="1"
                  step="1"
                  :disabled="isSaving"
                />
              </td>
              <td class="text-end">
                <button class="btn btn-outline-primary" type="button" :disabled="isSaving" @click="addRow">
                  追加
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="d-flex flex-column flex-md-row gap-3 align-items-md-center justify-content-between mt-4">
        <div class="flex-grow-1">
          <p
            v-if="(saveAttempted || touched) && hasErrors && firstErrorMessage"
            class="text-danger small mb-0"
          >
            {{ firstErrorMessage }}
          </p>
          <p v-else-if="hasTouchedNewRow && newRowValidationMessage" class="text-danger small mb-0">
            {{ newRowValidationMessage }}
          </p>
          <p v-else-if="granularitiesSaveError" class="text-danger small mb-0">{{ granularitiesSaveError }}</p>
          <p v-else-if="saved" class="text-success small mb-0">保存しました。</p>
        </div>
        <button
          class="btn btn-primary ms-md-auto"
          type="button"
          :disabled="isSaving || editableRows.length === 0"
          @click="handleSave"
        >
          {{ isSaving ? "保存中..." : "変更を保存" }}
        </button>
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
</style>
