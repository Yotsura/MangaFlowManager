<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useCustomDatesStore, type CustomDateType } from "@/store/customDatesStore";
import { useAuthStore } from "@/store/authStore";
import { formatLocalDate } from "@/utils/dateUtils";
import { storeToRefs } from "pinia";
import EditModal from "@/components/common/EditModal.vue";

interface Props {
  date: Date | null;
  show: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  "update:show": [value: boolean];
  close: [];
}>();

const customDatesStore = useCustomDatesStore();
const authStore = useAuthStore();
const { user } = storeToRefs(authStore);

const selectedType = ref<CustomDateType | null>(null);
const customHours = ref<number>(0);
const isSaving = ref(false);
const errorMessage = ref<string | null>(null);

const dateString = computed(() => {
  if (!props.date) return "";
  return formatLocalDate(props.date);
});

const formattedDate = computed(() => {
  if (!props.date) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(props.date);
});

const existingCustomDate = computed(() => {
  if (!dateString.value) return null;
  return customDatesStore.getCustomDateByDate(dateString.value);
});

// 設定が変更されたかどうか
const hasChanged = computed(() => {
  const existingType = existingCustomDate.value?.type || null;
  const existingHours = existingCustomDate.value?.customHours || 0;
  const typeChanged = selectedType.value !== existingType;
  const hoursChanged = selectedType.value === 'custom-hours' && customHours.value !== existingHours;
  return typeChanged || hoursChanged;
});

// モーダルが開かれたときに既存の設定を読み込む
watch(
  () => props.show,
  (newShow) => {
    if (newShow && dateString.value) {
      const existing = existingCustomDate.value;
      selectedType.value = existing?.type || null;
      customHours.value = existing?.customHours || 0;
      errorMessage.value = null;
    }
  }
);

const handleSave = async () => {
  if (!user.value?.uid || !dateString.value) {
    return;
  }

  isSaving.value = true;
  errorMessage.value = null;

  try {
    // 設定なし（null）の場合は削除、それ以外は保存
    if (selectedType.value === null) {
      await customDatesStore.removeCustomDate(user.value.uid, dateString.value);
    } else {
      await customDatesStore.setCustomDate(
        user.value.uid,
        dateString.value,
        selectedType.value,
        selectedType.value === 'custom-hours' ? customHours.value : undefined
      );
    }
    handleClose();
  } catch (error) {
    console.error("Failed to save custom date:", error);
    errorMessage.value = "保存に失敗しました。もう一度お試しください。";
  } finally {
    isSaving.value = false;
  }
};

const handleClose = () => {
  emit("update:show", false);
  emit("close");
};
</script>

<template>
  <EditModal :show="show" title="日付設定" size="md" centered
    :can-save="hasChanged" :is-saving="isSaving"
    @close="handleClose" @save="handleSave">
    <p class="mb-3">
      <strong>{{ formattedDate }}</strong>
    </p>

    <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>

    <div class="mb-3">
      <label class="form-label">設定タイプ</label>
      <div class="form-check" @click="selectedType = 'custom-holiday'">
        <input id="type-custom-holiday" v-model="selectedType"
          class="form-check-input" type="radio" value="custom-holiday"
          :disabled="isSaving"/>
        <label class="form-check-label w-100" for="type-custom-holiday">
          <strong>任意休日</strong>
          <div class="text-muted small">祝日設定で設定した作業可能時間を適用します</div>
        </label>
              </div>
              <div class="form-check" @click="selectedType = 'unavailable'">
                <input id="type-unavailable" v-model="selectedType"
                  class="form-check-input" type="radio" value="unavailable"
                  :disabled="isSaving"/>
                <label class="form-check-label w-100" for="type-unavailable">
                  <strong>作業不可</strong>
                  <div class="text-muted small">作業可能時間を0時間として扱います</div>
                </label>
              </div>
              <div class="form-check" @click="selectedType = 'custom-hours'">
                <input id="type-custom-hours" v-model="selectedType"
                  class="form-check-input" type="radio" value="custom-hours"
                  :disabled="isSaving"/>
                <label class="form-check-label w-100" for="type-custom-hours">
                  <div class="d-flex align-items-center justify-content-between">
                    <div>
                      <strong>固有作業時間</strong>
                      <div class="text-muted small">この日専用の作業可能時間を設定します</div>
                    </div>
                    <div v-if="selectedType === 'custom-hours'" class="ms-3" @click.stop>
                      <div class="input-group input-group-sm" style="width: 130px;">
                        <input id="custom-hours-input" v-model.number="customHours"
                          class="form-control" type="number"
                          min="0" max="24" step="0.5"
                          :disabled="isSaving"/>
                        <span class="input-group-text">時間</span>
                      </div>
                    </div>
                  </div>
                </label>
              </div>
              <div class="form-check" @click="selectedType = null">
                <input
                  id="type-none"
                  v-model="selectedType"
                  class="form-check-input"
                  type="radio"
                  :value="null"
                  :disabled="isSaving"
                />
                <label class="form-check-label w-100" for="type-none">
                  <strong>設定なし</strong>
                  <div class="text-muted small">通常の曜日設定を適用します</div>
                </label>
              </div>
            </div>
  </EditModal>
</template>

<style scoped>
.form-check {
  padding: 0.75rem;
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
  margin-bottom: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.form-check:hover {
  border-color: #0d6efd;
  background-color: #f8f9fa;
}

.form-check:has(.form-check-input:checked) {
  background-color: #e7f3ff;
  border-color: #0d6efd;
}

.form-check:has(.form-check-input:disabled) {
  cursor: not-allowed;
  opacity: 0.6;
}

.form-check-label {
  cursor: pointer;
  margin-bottom: 0;
}

.form-check-input {
  cursor: pointer;
}
</style>
