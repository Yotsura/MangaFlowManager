<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useCustomDatesStore, type CustomDateType } from "@/store/customDatesStore";
import { useAuthStore } from "@/store/authStore";
import { storeToRefs } from "pinia";

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
const isSaving = ref(false);
const errorMessage = ref<string | null>(null);

// 日本時間でYYYY-MM-DD形式の文字列を取得
const getLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const dateString = computed(() => {
  if (!props.date) return "";
  return getLocalDateString(props.date);
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
  return selectedType.value !== existingType;
});

// モーダルが開かれたときに既存の設定を読み込む
watch(
  () => props.show,
  (newShow) => {
    if (newShow && dateString.value) {
      const existing = existingCustomDate.value;
      selectedType.value = existing?.type || null;
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
      await customDatesStore.setCustomDate(user.value.uid, dateString.value, selectedType.value);
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
  <Transition name="modal-fade">
    <div v-if="show" class="modal d-block" tabindex="-1" @click.self="handleClose">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">日付設定</h5>
            <button type="button" class="btn-close" :disabled="isSaving" @click="handleClose"></button>
          </div>
          <div class="modal-body">
            <p class="mb-3">
              <strong>{{ formattedDate }}</strong>
            </p>

            <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>

            <div class="mb-3">
              <label class="form-label">設定タイプ</label>
              <div class="form-check" @click="selectedType = 'custom-holiday'">
                <input
                  id="type-custom-holiday"
                  v-model="selectedType"
                  class="form-check-input"
                  type="radio"
                  value="custom-holiday"
                  :disabled="isSaving"
                />
                <label class="form-check-label w-100" for="type-custom-holiday">
                  <strong>任意休日</strong>
                  <div class="text-muted small">祝日設定で設定した作業可能時間を適用します</div>
                </label>
              </div>
              <div class="form-check" @click="selectedType = 'unavailable'">
                <input
                  id="type-unavailable"
                  v-model="selectedType"
                  class="form-check-input"
                  type="radio"
                  value="unavailable"
                  :disabled="isSaving"
                />
                <label class="form-check-label w-100" for="type-unavailable">
                  <strong>作業不可</strong>
                  <div class="text-muted small">作業可能時間を0時間として扱います</div>
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
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" :disabled="isSaving" @click="handleClose">キャンセル</button>
            <button type="button" class="btn btn-primary" :disabled="isSaving || !hasChanged" @click="handleSave">
              {{ isSaving ? "保存中..." : "保存" }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
  <Transition name="backdrop-fade">
    <div v-if="show" class="modal-backdrop"></div>
  </Transition>
</template>

<style scoped>
.modal {
  background-color: rgba(0, 0, 0, 0.5);
}

/* モーダルフェードアニメーション */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.15s linear;
}

.modal-fade-enter-active .modal-dialog,
.modal-fade-leave-active .modal-dialog {
  transition: transform 0.3s ease-out;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .modal-dialog {
  transform: translateY(-50px);
}

.modal-fade-leave-to .modal-dialog {
  transform: translateY(-50px);
}

/* 背景フェードアニメーション */
.backdrop-fade-enter-active,
.backdrop-fade-leave-active {
  transition: opacity 0.15s linear;
}

.backdrop-fade-enter-from,
.backdrop-fade-leave-to {
  opacity: 0;
}

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
