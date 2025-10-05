<template>
  <div class="work-pace-card">
    <div class="card">
      <div class="card-header">
        <div class="d-flex align-items-center justify-content-between">
          <h6 class="card-title mb-0">
            <i class="bi bi-speedometer2 me-2"></i>
            作業ペース
          </h6>
          <span :class="`badge bg-${paceColor}`">
            {{ paceMessage }}
          </span>
        </div>
      </div>
      <div class="card-body">
        <div class="row g-3">
          <!-- 今日の必要工数 -->
          <div class="col-6">
            <div class="text-center">
              <div class="h4 mb-1" :class="`text-${paceColor}`">
                {{ paceCalculation.todayRequiredHours.toFixed(1) }}h
              </div>
              <small class="text-muted">今日の必要工数</small>
            </div>
          </div>

          <!-- 1日あたりの必要工数 -->
          <div class="col-6">
            <div class="text-center">
              <div class="h4 mb-1">
                {{ paceCalculation.dailyRequiredHours.toFixed(1) }}h
              </div>
              <small class="text-muted">1日あたり必要工数</small>
            </div>
          </div>
        </div>

        <hr class="my-3">

        <div class="row g-2">
          <!-- 残り作業可能時間 -->
          <div class="col-6">
            <div class="d-flex align-items-center">
              <i class="bi bi-clock me-2 text-muted"></i>
              <div>
                <div class="fw-medium">{{ paceCalculation.remainingWorkableHours.toFixed(1) }}h</div>
                <small class="text-muted">残り作業可能時間</small>
              </div>
            </div>
          </div>

          <!-- 残り作業可能日数 -->
          <div class="col-6">
            <div class="d-flex align-items-center">
              <i class="bi bi-calendar-date me-2 text-muted"></i>
              <div>
                <div class="fw-medium">{{ paceCalculation.workableDaysUntilDeadline }}日</div>
                <small class="text-muted">残り作業可能日数</small>
              </div>
            </div>
          </div>

          <!-- 締切まで -->
          <div class="col-6">
            <div class="d-flex align-items-center">
              <i class="bi bi-calendar-x me-2 text-muted"></i>
              <div>
                <div class="fw-medium">{{ paceCalculation.daysUntilDeadline }}日</div>
                <small class="text-muted">締切まで</small>
              </div>
            </div>
          </div>

          <!-- 進捗状況 -->
          <div class="col-6">
            <div class="d-flex align-items-center">
              <i class="bi bi-graph-up me-2 text-muted"></i>
              <div>
                <div class="fw-medium" :class="paceCalculation.isOnSchedule ? 'text-success' : 'text-danger'">
                  {{ paceCalculation.isOnSchedule ? '順調' : '要注意' }}
                </div>
                <small class="text-muted">進捗状況</small>
              </div>
            </div>
          </div>
        </div>

        <!-- 進捗バー -->
        <div class="mt-3">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <small class="text-muted">作業負荷</small>
            <small class="text-muted">{{ workloadPercentage.toFixed(0) }}%</small>
          </div>
          <div class="progress" style="height: 8px;">
            <div
              class="progress-bar"
              :class="`bg-${paceColor}`"
              :style="{ width: Math.min(workloadPercentage, 100) + '%' }"
            ></div>
          </div>
          <div v-if="workloadPercentage > 100" class="text-danger small mt-1">
            <i class="bi bi-exclamation-triangle me-1"></i>
            作業時間が不足しています
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { WorkPaceCalculation } from '@/utils/workloadUtils';
import { getPaceStatusColor, getPaceStatusMessage } from '@/utils/workloadUtils';

interface Props {
  paceCalculation: WorkPaceCalculation;
  totalRemainingHours: number;
}

const props = defineProps<Props>();

const paceColor = computed(() => getPaceStatusColor(props.paceCalculation.paceStatus));
const paceMessage = computed(() => getPaceStatusMessage(props.paceCalculation.paceStatus));

// 作業負荷の割合（必要時間 / 利用可能時間 * 100）
const workloadPercentage = computed(() => {
  if (props.paceCalculation.remainingWorkableHours === 0) {
    return props.totalRemainingHours > 0 ? 200 : 0;
  }
  return (props.totalRemainingHours / props.paceCalculation.remainingWorkableHours) * 100;
});
</script>

<style scoped>
.work-pace-card .card {
  border: none;
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
}

.progress {
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.1);
}

.progress-bar {
  transition: width 0.3s ease;
}
</style>
