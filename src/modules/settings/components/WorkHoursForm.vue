<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { storeToRefs } from "pinia";

import { useAuthStore } from "@/store/authStore";
import { useSettingsStore } from "@/store/settingsStore";

interface DayOption {
  key: string;
  label: string;
}

interface DayFormState extends DayOption {
  enabled: boolean;
  hours: number;
}

const DEFAULT_HOURS = 8.0;

const dayOptions: DayOption[] = [
  { key: "monday", label: "月曜日" },
  { key: "tuesday", label: "火曜日" },
  { key: "wednesday", label: "水曜日" },
  { key: "thursday", label: "木曜日" },
  { key: "friday", label: "金曜日" },
  { key: "saturday", label: "土曜日" },
  { key: "sunday", label: "日曜日" },
  { key: "holiday", label: "祝日" },
];

const settingsStore = useSettingsStore();
const authStore = useAuthStore();

const { workHours, loadingWorkHours, savingWorkHours, loadError, saveError, workHoursLoaded } = storeToRefs(settingsStore);
const { user } = storeToRefs(authStore);
const userId = computed(() => user.value?.uid ?? null);

const toFormState = (options: DayOption[], storedHours: typeof workHours.value): DayFormState[] =>
  options.map((option) => {
    const existing = storedHours.find((entry) => entry.day === option.key);
    return {
      ...option,
      enabled: Boolean(existing),
      hours: existing?.hours ?? DEFAULT_HOURS,
    };
  });

const formState = reactive<DayFormState[]>(toFormState(dayOptions, workHours.value));
const saved = ref(false);
const isSaving = computed(() => savingWorkHours.value);
const isLoading = computed(() => loadingWorkHours.value && !workHoursLoaded.value);

const ensureSettingsLoaded = async () => {
  if (!userId.value) {
    return;
  }

  if (!workHoursLoaded.value && !loadingWorkHours.value) {
    await settingsStore.fetchWorkHours(userId.value);
  }
};

onMounted(async () => {
  if (!user.value) {
    await authStore.ensureInitialized();
  }
  await ensureSettingsLoaded();
});

watch(userId, async (next, prev) => {
  if (next && next !== prev) {
    await settingsStore.fetchWorkHours(next);
  }
});

watch(
  workHours,
  (next) => {
    const updated = toFormState(dayOptions, next);
    updated.forEach((row) => {
      const target = formState.find((item) => item.key === row.key);
      if (target) {
        target.enabled = row.enabled;
        target.hours = row.hours;
      }
    });
  },
  { deep: true },
);

watch(
  formState,
  () => {
    if (!isSaving.value) {
      saved.value = false;
    }
  },
  { deep: true },
);

const hasValidationError = computed(() => formState.some((row) => row.enabled && (row.hours <= 0 || row.hours > 24)));

const canSave = computed(() => !isSaving.value && !hasValidationError.value && !isLoading.value);

const validationMessage = computed(() => (hasValidationError.value ? "作業時間は0時間より大きく、24時間以下で設定してください。" : null));

const handleSubmit = async () => {
  if (hasValidationError.value) {
    return;
  }

  const selectedHours = formState.filter((row) => row.enabled).map((row) => ({ day: row.key, hours: row.hours }));

  if (!userId.value) {
    return;
  }

  try {
    await settingsStore.saveWorkHours(userId.value, selectedHours);
    saved.value = true;
    console.log('作業時間設定を保存しました');
  } catch (error) {
    console.error('作業時間設定の保存に失敗しました:', error);
    alert('作業時間設定の保存に失敗しました: ' + (error instanceof Error ? error.message : String(error)));
  }
};

defineExpose({
  submit: handleSubmit,
  isSaving: () => isSaving.value,
  canSave: () => canSave.value,
});
</script>

<template>
  <form class="work-hours-form" @submit.prevent="handleSubmit">
    <div v-if="isLoading" class="alert alert-info" role="status">作業可能時間を読み込み中です...</div>
    <div v-else-if="loadError" class="alert alert-danger" role="alert">
      読み込みエラー: {{ loadError }}
    </div>
    <div v-if="saveError" class="alert alert-danger" role="alert">
      保存エラー: {{ saveError }}
    </div>
    <template v-else>
      <div class="list-group">
        <div v-for="row in formState" :key="row.key" class="list-group-item p-2">
          <div class="d-flex align-items-center justify-content-between">
            <div class="form-check mb-0">
              <input :id="`work-hours-${row.key}`" v-model="row.enabled" class="form-check-input" type="checkbox" :disabled="isLoading" />
              <label class="form-check-label fw-medium" :for="`work-hours-${row.key}`">{{ row.label }}</label>
            </div>

            <div v-if="row.enabled" class="d-flex align-items-center gap-2">
              <input v-model.number="row.hours" class="form-control form-control-sm" type="number" min="0.5" max="24" step="0.5" :disabled="isLoading" required />
              <span class="text-muted small">時間</span>
            </div>
          </div>

          <div v-if="row.enabled && (row.hours <= 0 || row.hours > 24)" class="text-danger small mt-1">作業時間は0.5時間以上、24時間以下で設定してください。</div>
        </div>
      </div>

      <div class="form-feedback mt-4">
        <p v-if="validationMessage" class="text-danger small mb-0">{{ validationMessage }}</p>
        <p v-else-if="saveError" class="text-danger small mb-0">{{ saveError }}</p>
        <p v-else-if="saved" class="text-success small mb-0">保存しました。</p>
      </div>
    </template>
  </form>
</template>

<style scoped>
.list-group-item {
  border: none;
  border-bottom: 1px solid rgba(0, 0, 0, 0.125);
}

.list-group-item:last-child {
  border-bottom: none;
}

.form-control[type="number"] {
  width: 110px;
}

.form-control-sm[type="number"] {
  width: 100px;
}

.form-feedback {
  min-height: 1rem;
}
</style>
