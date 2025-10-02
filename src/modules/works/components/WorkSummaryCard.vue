<script setup lang="ts">
import { computed } from "vue";

import type { Work } from "@/store/worksStore";

const props = defineProps<{
  work: Work;
  stageCount: number;
  progressPercent: number;
  primaryGranularityLabel: string | null;
  totalPanels: number;
  saving: boolean;
  canSave: boolean;
  saveError: string | null;
  lastSaveStatus: string | null;
  isEditMode: boolean;
}>();

const emit = defineEmits<{
  (event: "request-save"): void;
  (event: "request-delete"): void;
  (event: "toggle-edit-mode"): void;
}>();

const totalPages = computed(() => props.work.pages.length);

const averagePanelsPerPage = computed(() => {
  if (!totalPages.value) {
    return 0;
  }
  return props.totalPanels / totalPages.value;
});

const unitHours = computed(() => props.work.unitEstimatedHours);

const perPageHours = computed(() => (props.stageCount === 0 ? 0 : unitHours.value));

const saveStatusMessage = computed(() => {
  if (props.saving) {
    return "保存中です...";
  }
  if (props.saveError) {
    return props.saveError;
  }
  if (props.lastSaveStatus) {
    return props.lastSaveStatus;
  }
  if (!props.canSave) {
    return "変更はありません。";
  }
  return "変更があります。保存してください。";
});

const formatDate = (value: string) => {
  if (!value) {
    return "―";
  }
  try {
    return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return value;
  }
};
</script>

<template>
  <div class="summary-card">
    <dl class="row g-2 mb-0">
      <div class="col-6">
        <dt class="text-muted small">ステータス</dt>
        <dd class="mb-0 fw-semibold">{{ work.status }}</dd>
      </div>
      <div class="col-6">
        <dt class="text-muted small">進捗率</dt>
        <dd class="mb-0 fw-semibold">{{ progressPercent }}%</dd>
      </div>
      <div class="col-6">
        <dt class="text-muted small">開始日</dt>
        <dd class="mb-0">{{ formatDate(work.startDate) }}</dd>
      </div>
      <div class="col-6">
        <dt class="text-muted small">締め切り</dt>
        <dd class="mb-0">{{ formatDate(work.deadline) }}</dd>
      </div>
      <div class="col-6">
        <dt class="text-muted small">ページ数</dt>
        <dd class="mb-0">{{ totalPages }}</dd>
      </div>
      <div class="col-6">
        <dt class="text-muted small">総コマ数</dt>
        <dd class="mb-0">{{ totalPanels }}</dd>
      </div>
      <div class="col-6">
        <dt class="text-muted small">平均コマ数 / ページ</dt>
        <dd class="mb-0">{{ averagePanelsPerPage.toFixed(1) }}</dd>
      </div>
      <div class="col-6">
        <dt class="text-muted small">推定工数 / {{ primaryGranularityLabel ?? "単位" }}</dt>
        <dd class="mb-0">{{ perPageHours.toFixed(2) }} h</dd>
      </div>
      <div class="col-6">
        <dt class="text-muted small">推定総工数</dt>
        <dd class="mb-0 fw-semibold">{{ work.totalEstimatedHours.toFixed(2) }} h</dd>
      </div>
      <div class="col-6">
        <dt class="text-muted small">最終更新</dt>
        <dd class="mb-0">{{ formatDate(work.updatedAt) }}</dd>
      </div>
    </dl>

    <div class="summary-card__actions">
      <div v-if="isEditMode"
        class="summary-card__message"
        :class="{
          'text-danger': !!saveError,
          'text-success': !saveError && !!lastSaveStatus && !saving,
          'text-muted': !saveError && !lastSaveStatus,
        }"
      >
        {{ saveStatusMessage }}
      </div>

      <button v-if="!isEditMode" type="button" class="btn btn-primary" @click="emit('toggle-edit-mode')">
        作品を編集する
      </button>

      <template v-if="isEditMode">
        <button type="button" class="btn btn-primary" :disabled="saving || !canSave" @click="emit('request-save')">
          作品を保存
        </button>

        <button type="button" class="btn btn-outline-danger" @click="emit('request-delete')">
          作品を削除
        </button>

        <button type="button" class="btn btn-secondary" @click="emit('toggle-edit-mode')">
          編集をキャンセル
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.summary-card {
  font-size: 0.9rem;
}

dt {
  margin-bottom: 0.15rem;
}

dd {
  margin-bottom: 0.4rem;
}

.summary-card__actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.summary-card__message {
  font-size: 0.8rem;
}
</style>
