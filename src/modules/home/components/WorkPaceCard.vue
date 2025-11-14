<template>
  <div class="work-pace-card">
    <div class="card h-100" @click="openWork" style="cursor: pointer;">
      <div class="card-body">
        <!-- ヘッダー: 最優先作品 + 作品名 -->
        <div class="d-flex align-items-center justify-content-between mb-3 pb-3 border-bottom">
          <div>
            <div class="d-flex align-items-center mb-1">
              <i class="bi bi-exclamation-triangle me-2 text-warning"></i>
              <small class="text-muted">最優先作品</small>
            </div>
            <h6 class="mb-0 fw-bold">{{ workTitle }}</h6>
          </div>
          <span :class="`badge bg-${paceColor}`">
            {{ paceMessage }}
          </span>
        </div>

        <!-- 1日の必要工数 -->
        <div class="text-center mb-3 pb-3 border-bottom">
          <small class="text-muted d-block mb-2">
            <i class="bi bi-clock-history me-1"></i>
            1日の必要工数
          </small>
          <div class="h3 mb-0" :class="`text-${paceColor}`">
            {{ paceCalculation.dailyRequiredHours.toFixed(1) }}h
          </div>
        </div>

        <!-- 進捗率と推定工数 -->
        <div class="row g-3 mb-3">
          <div class="col-6">
            <small class="text-muted d-block">
              <i class="bi bi-graph-up me-1"></i>
              進捗率
            </small>
            <div class="fw-medium">{{ progressPercentage }}%</div>
          </div>
          <div class="col-6">
            <small class="text-muted d-block">
              <i class="bi bi-hourglass-split me-1"></i>
              推定工数
            </small>
            <div class="fw-medium">残り {{ totalRemainingHours.toFixed(1) }}h / {{ totalEstimatedHours.toFixed(1) }}h</div>
          </div>
        </div>

        <!-- 締切までと残り作業可能時間 -->
        <div class="row g-3 mb-3">
          <div class="col-6">
            <small class="text-muted d-block">
              <i class="bi bi-calendar-x me-1"></i>
              締切まで
            </small>
            <div class="fw-medium">{{ paceCalculation.daysUntilDeadline }}日</div>
          </div>
          <div class="col-6">
            <small class="text-muted d-block">
              <i class="bi bi-calendar-check me-1"></i>
              残り作業可能時間
            </small>
            <div class="fw-medium">{{ paceCalculation.workableDaysUntilDeadline }}日 ({{ paceCalculation.remainingWorkableHours.toFixed(1) }}h)</div>
          </div>
        </div>

        <!-- 作業負荷表示 -->
        <div class="pt-2 border-top">
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
              :class="`bg-${paceColor}`"
              :style="{ width: Math.min(workloadPercentage, 100) + '%' }"
            ></div>
          </div>
          <div v-if="workloadPercentage > 100" class="text-danger small mt-2">
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
import { useRouter } from 'vue-router';
import type { WorkPaceCalculation } from '@/utils/workloadUtils';
import { getPaceStatusColor, getPaceStatusMessage } from '@/utils/workloadUtils';

interface Props {
  workId: string;
  workTitle: string;
  paceCalculation: WorkPaceCalculation;
  totalRemainingHours: number;
  totalEstimatedHours: number;
  progressPercentage: number;
}

const props = defineProps<Props>();
const router = useRouter();

const paceColor = computed(() => getPaceStatusColor(props.paceCalculation.paceStatus));
const paceMessage = computed(() => getPaceStatusMessage(props.paceCalculation.paceStatus));

// 作業負荷の割合（必要時間 / 利用可能時間 * 100）
const workloadPercentage = computed(() => {
  if (props.paceCalculation.remainingWorkableHours === 0) {
    return props.totalRemainingHours > 0 ? 200 : 0;
  }
  return (props.totalRemainingHours / props.paceCalculation.remainingWorkableHours) * 100;
});

// 作品を開く
const openWork = () => {
  router.push(`/works/${props.workId}`);
};
</script>

<style scoped>
.work-pace-card .card {
  transition: transform 0.2s, box-shadow 0.2s;
}

.work-pace-card .card:hover {
  transform: translateY(-2px);
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15) !important;
}
</style>
