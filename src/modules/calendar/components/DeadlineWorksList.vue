<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useWorksStore } from '@/store/worksStore';
import { useWorkMetrics } from '@/composables/useWorkMetrics';

const worksStore = useWorksStore();
const { works } = storeToRefs(worksStore);

// 締切が設定されている作品のリスト
const worksWithDeadline = computed(() => {
  return works.value
    .filter(work => work.deadline && work.status !== '完了')
    .map(work => {
      const metrics = worksStore.calculateActualWorkHours(work.id);
      const workComputed = computed(() => work);
      const workMetrics = useWorkMetrics(workComputed);

      return {
        id: work.id,
        title: work.title,
        deadline: work.deadline,
        progressPercentage: metrics.progressPercentage,
        remainingHours: metrics.remainingEstimatedHours,
        totalHours: metrics.totalEstimatedHours,
        daysUntilDeadline: workMetrics.daysUntilDeadline.value,
        availableWorkHours: workMetrics.availableWorkHours.value
      };
    })
    .sort((a, b) => {
      // 締切の近い順にソート
      return new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime();
    });
});
</script>

<template>
  <div v-if="worksWithDeadline.length > 0" class="card">
    <div class="card-header">
      <h6 class="card-title mb-0">
        <i class="bi bi-calendar-check me-2"></i>
        締切設定作品
      </h6>
    </div>
    <div class="card-body p-0">
      <div class="list-group list-group-flush">
        <router-link
          v-for="work in worksWithDeadline"
          :key="work.id"
          :to="`/works/${work.id}`"
          class="list-group-item list-group-item-action px-3 py-2"
        >
          <div class="d-flex justify-content-between align-items-start mb-1">
            <div class="fw-semibold small">{{ work.title }}</div>
            <div class="d-flex align-items-center gap-2 ms-2 flex-shrink-0">
              <span class="badge bg-info text-dark">{{ work.daysUntilDeadline }}日（{{ work.availableWorkHours.toFixed(1) }}h）</span>
              <span class="badge bg-secondary">{{ new Date(work.deadline!).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/') }}</span>
            </div>
          </div>
          <div class="d-flex justify-content-between align-items-center">
            <div class="small text-muted">
              進捗 {{ work.progressPercentage }}%
            </div>
            <div class="small text-muted">
              残り {{ work.remainingHours.toFixed(1) }}h / {{ work.totalHours.toFixed(1) }}h
            </div>
          </div>
        </router-link>
      </div>
    </div>
  </div>
</template>
