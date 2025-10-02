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
  start: string;
  end: string;
}

const DEFAULT_START = "09:00";
const DEFAULT_END = "18:00";

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
      start: existing?.start ?? DEFAULT_START,
      end: existing?.end ?? DEFAULT_END,
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
        target.start = row.start;
        target.end = row.end;
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

const hasValidationError = computed(() =>
  formState.some((row) => row.enabled && (!row.start || !row.end || row.start >= row.end)),
);

const validationMessage = computed(() =>
  hasValidationError.value ? "開始時刻は終了時刻より前に設定してください。" : null,
);

const handleSubmit = async () => {
  if (hasValidationError.value) {
    return;
  }

  const selectedHours = formState
    .filter((row) => row.enabled)
    .map((row) => ({ day: row.key, start: row.start, end: row.end }));

  if (!userId.value) {
    return;
  }

  try {
    await settingsStore.saveWorkHours(userId.value, selectedHours);
    saved.value = true;
  } catch (error) {
    console.error(error);
  }
};
</script>

<template>
  <form class="work-hours-form" @submit.prevent="handleSubmit">
    <div v-if="isLoading" class="alert alert-info" role="status">
      作業可能時間を読み込み中です...
    </div>
    <div v-else-if="loadError" class="alert alert-danger" role="alert">
      {{ loadError }}
    </div>

    <div class="list-group">
      <div v-for="row in formState" :key="row.key" class="list-group-item list-group-item-action">
        <div class="d-flex flex-column flex-md-row align-items-md-center gap-3">
          <div class="form-check">
            <input
              :id="`work-hours-${row.key}`"
              v-model="row.enabled"
              class="form-check-input"
              type="checkbox"
              :disabled="isLoading"
            />
            <label class="form-check-label" :for="`work-hours-${row.key}`">{{ row.label }}</label>
          </div>

          <div class="d-flex align-items-center gap-2 flex-wrap">
            <input
              v-model="row.start"
              class="form-control"
              type="time"
              :disabled="!row.enabled || isLoading"
              required
            />
            <span class="text-muted">～</span>
            <input
              v-model="row.end"
              class="form-control"
              type="time"
              :disabled="!row.enabled || isLoading"
              required
            />
          </div>
        </div>

        <p v-if="row.enabled && row.start >= row.end" class="text-danger small mb-0 mt-2">
          開始時刻は終了時刻より前にしてください。
        </p>
      </div>
    </div>

    <div class="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mt-4">
      <div class="flex-grow-1">
        <p v-if="validationMessage" class="text-danger small mb-0">{{ validationMessage }}</p>
        <p v-else-if="saveError" class="text-danger small mb-0">{{ saveError }}</p>
        <p v-else-if="saved" class="text-success small mb-0">保存しました。</p>
      </div>
      <button class="btn btn-primary ms-md-auto" type="submit" :disabled="isSaving || hasValidationError || isLoading">
        {{ isSaving ? "保存中..." : "保存" }}
      </button>
    </div>
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

.form-control[type="time"] {
  width: 130px;
}
</style>
