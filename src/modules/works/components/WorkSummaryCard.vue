<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useWorksStore, WORK_STATUSES, type WorkStatus } from '@/store/worksStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useWorkMetrics } from '@/composables/useWorkMetrics';
import { getRequiredHoursClass, formatRequiredHours } from '../utils/workDetailUtils';
import { getPaceStatusColor } from '@/utils/workloadUtils';
import { getPageStartLabel, normalizePageStartPosition } from '@/utils/workUtils';
import type { PageStartPosition } from '@/types/work';

interface Props {
  workId: string;
  title: string;
  status: WorkStatus;
  startDate: string;
  deadline: string;
  isEditMode: boolean;
  lastSaveStatus: string | null;
  saveErrorMessage: string | null;
  pageStartPosition: PageStartPosition;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:title': [value: string];
  'update:status': [value: WorkStatus];
  'update:startDate': [value: string];
  'update:deadline': [value: string];
  'update:pageStartPosition': [value: PageStartPosition];
  'delete-work': [];
}>();

const worksStore = useWorksStore();
const settingsStore = useSettingsStore();

const work = computed(() => worksStore.getWorkById(props.workId));
const { granularities } = storeToRefs(settingsStore);

// 粒度ラベル
const workGranularities = computed(() => {
  if (work.value?.workGranularities && work.value.workGranularities.length > 0) {
    return work.value.workGranularities;
  }
  return granularities.value;
});

const topGranularityLabel = computed(() => {
  if (workGranularities.value.length === 0) return 'ページ';
  const topGranularity = workGranularities.value.reduce((max, current) =>
    current.weight > max.weight ? current : max
  );
  return topGranularity.label;
});

const lowestGranularityLabel = computed(() => {
  if (workGranularities.value.length === 0) return 'コマ';
  const lowestGranularity = workGranularities.value.reduce((min, current) =>
    current.weight < min.weight ? current : min
  );
  return lowestGranularity.label;
});

// メトリクス計算
const workMetrics = useWorkMetrics(work);

// 実際の作業時間データ
const actualWorkHours = computed(() => worksStore.calculateActualWorkHours(props.workId));
const pageCount = computed(() => actualWorkHours.value.pageCount);
const totalPanels = computed(() => actualWorkHours.value.totalPanels);
const remainingHours = computed(() => workMetrics.remainingEstimatedHours.value);
const totalHours = computed(() => actualWorkHours.value.totalEstimatedHours);
// 進捗率は共通の計算を使用
const progressPercentage = computed(() => actualWorkHours.value.progressPercentage);

const requiredHoursClass = computed(() => getRequiredHoursClass(
  workMetrics.todayRequiredHours.value,
  workMetrics.workPaceCalculation.value?.paceStatus
));
const requiredHoursText = computed(() => formatRequiredHours(workMetrics.todayRequiredHours.value));
const workloadPercentage = computed(() => {
  const paceCalculation = workMetrics.workPaceCalculation.value;
  return paceCalculation?.workloadPercentage ?? 0;
});
const workloadColor = computed(() => {
  const paceStatus = workMetrics.workPaceCalculation.value?.paceStatus;
  return paceStatus ? getPaceStatusColor(paceStatus) : 'secondary';
});
const normalizedPageStartPosition = computed(() => normalizePageStartPosition(props.pageStartPosition));
const pageStartLabel = computed(() => getPageStartLabel(props.pageStartPosition));

const handlePageStartToggle = (event: Event) => {
  const target = event.target as HTMLInputElement;
  emit('update:pageStartPosition', target.checked ? 'right' : 'left');
};
</script>

<template>
  <div class="card shadow-sm h-100">
    <div class="card-body py-3 py-md-3">
      <div class="row g-2 g-md-2">
        <!-- タイトル -->
        <div class="col-12 mb-1 mb-md-2">
          <input
            :value="title"
            @input="emit('update:title', ($event.target as HTMLInputElement).value)"
            type="text"
            class="form-control form-control-sm fw-semibold"
            placeholder="作品タイトル"
            :readonly="!isEditMode"
            style="font-size: 1.1rem;"
          />
        </div>

        <!-- 主要情報 -->
        <div class="col-12">
          <div class="small text-muted mb-1">
            <i class="bi bi-file-earmark-text me-1"></i>総工数
          </div>
          <div class="small py-1">{{ pageCount }}{{ topGranularityLabel }}（{{ totalPanels }}{{ lowestGranularityLabel }}）</div>
        </div>
        <div class="col-6">
          <div class="small text-muted mb-1">
            <i class="bi bi-hourglass-split me-1"></i>推定工数
          </div>
          <div class="fw-semibold small py-1 py-md-1" style="line-height: 1.3;">
            残り {{ remainingHours.toFixed(1) }}h / {{ totalHours.toFixed(1) }}h
          </div>
        </div>
        <div class="col-6">
          <div class="small text-muted mb-1">
            <i class="bi bi-graph-up me-1"></i>進捗率
          </div>
          <div class="fw-semibold small py-1 py-md-1">{{ progressPercentage }}%</div>
        </div>
        <div class="col-6">
          <div class="small text-muted mb-1">
            <i class="bi bi-calendar-check me-1"></i>締切まで
          </div>
          <div class="fw-semibold small py-1 py-md-1" style="line-height: 1.3;">{{ workMetrics.daysUntilDeadline.value }}日（{{ workMetrics.availableWorkHours.value.toFixed(1) }}h）</div>
        </div>
        <div class="col-6">
          <div class="small text-muted mb-1">
            <i class="bi bi-clock-history me-1"></i>今日の作業目安
          </div>
          <div class="small py-1 py-md-1" :class="requiredHoursClass">
            {{ requiredHoursText }}
          </div>
        </div>
        <div v-if="deadline && workMetrics.workPaceCalculation.value" class="col-12">
          <div class="pt-2 pb-2 mb-2 border-bottom">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <small class="text-muted">
                <i class="bi bi-speedometer2 me-1"></i>
                作業負荷
              </small>
              <small class="text-muted">{{ workloadPercentage.toFixed(0) }}%</small>
            </div>
            <div class="progress" style="height: 8px;">
              <div
                class="progress-bar"
                :style="{ width: Math.min(workloadPercentage, 100) + '%', backgroundColor: workloadColor }"
              ></div>
            </div>
            <div v-if="workloadPercentage > 100" class="text-danger small mt-2">
              <i class="bi bi-exclamation-triangle me-1"></i>
              作業時間が不足しています
            </div>
          </div>
        </div>
        <div class="col-6">
          <div class="small text-muted mb-1">
            <i class="bi bi-calendar-event me-1"></i>開始日
          </div>
          <input
            :value="startDate"
            @input="emit('update:startDate', ($event.target as HTMLInputElement).value)"
            type="date"
            class="form-control form-control-sm"
            :max="deadline || undefined"
            :readonly="!isEditMode"
          />
        </div>
        <div class="col-6">
          <div class="small text-muted mb-1">
            <i class="bi bi-calendar-x me-1"></i>締め切り
          </div>
          <input
            :value="deadline"
            @input="emit('update:deadline', ($event.target as HTMLInputElement).value)"
            type="date"
            class="form-control form-control-sm"
            :min="startDate || undefined"
            :readonly="!isEditMode"
          />
        </div>
        <div class="col-6">
          <div class="small text-muted mb-1">
            <i class="bi bi-flag me-1"></i>ステータス
          </div>
          <select
            :value="status"
            @change="emit('update:status', ($event.target as HTMLSelectElement).value as WorkStatus)"
            class="form-select form-select-sm"
            :disabled="!isEditMode"
          >
            <option v-for="option in WORK_STATUSES" :key="option" :value="option">{{ option }}</option>
          </select>
        </div>

        <div class="col-6">
          <div class="small text-muted mb-1">
            <i class="bi bi-layout-sidebar me-1"></i>ページの開始位置
          </div>
          <div v-if="isEditMode" class="d-flex flex-column align-items-start gap-1 ps-0">
            <div class="form-check form-switch d-flex align-items-center gap-2 mb-0">
              <input
                class="form-check-input"
                type="checkbox"
                role="switch"
                :checked="normalizedPageStartPosition === 'right'"
                @change="handlePageStartToggle"
              />
              <span class="small">{{ pageStartLabel }}</span>
            </div>
          </div>
          <div v-else class="small">
            <span class="badge bg-light text-dark">{{ pageStartLabel }}</span>
          </div>
        </div>

        <!-- ID表示 -->
        <div class="mt-3 pt-2 border-top">
          <p class="text-muted small mb-0 text-center" style="font-size: 0.75rem;">ID: {{ workId }}</p>
        </div>

        <!-- 削除ボタン（編集モード時のみ） -->
        <div v-if="isEditMode" class="mt-2 pt-2 border-top">
          <button type="button" class="btn btn-sm btn-danger w-100" @click="emit('delete-work')">
            <i class="bi bi-trash me-1"></i>作品を削除する
          </button>
        </div>
      </div>

      <!-- 保存ステータス表示 -->
      <div v-if="lastSaveStatus || saveErrorMessage" class="mt-2">
        <div v-if="saveErrorMessage" class="alert alert-danger py-2 mb-0 small" role="alert">
          <i class="bi bi-exclamation-triangle me-1"></i>{{ saveErrorMessage }}
        </div>
        <div v-else-if="lastSaveStatus === 'success'" class="alert alert-success py-2 mb-0 small" role="alert">
          <i class="bi bi-check-circle me-1"></i>保存しました
        </div>
      </div>
    </div>
  </div>
</template>
