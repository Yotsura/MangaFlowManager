<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useWorksStore } from '@/store/worksStore';
import { useCustomDatesStore } from '@/store/customDatesStore';
import WorkPaceCard from '@/modules/calendar/components/WorkPaceCard.vue';
import { getHolidaysWithCabinetOfficeData } from '@/utils/dateUtils';
import type { Holiday } from '@/utils/dateUtils';
import { calculateWorkPace } from '@/utils/workloadUtils';

const authStore = useAuthStore();
const settingsStore = useSettingsStore();
const worksStore = useWorksStore();
const customDatesStore = useCustomDatesStore();

const { displayName, user } = storeToRefs(authStore);
const { workHours } = storeToRefs(settingsStore);
const { works } = storeToRefs(worksStore);

const currentYear = ref(new Date().getFullYear());
const holidays = ref<Holiday[]>([]);

// 祝日データを更新
const updateHolidays = async () => {
  try {
    const yearHolidays = await getHolidaysWithCabinetOfficeData(currentYear.value);
    holidays.value = yearHolidays;
  } catch (error) {
    console.warn('Failed to update holidays:', error);
  }
};

// 作業ペース計算
const workPaceCalculations = computed(() => {
  if (!workHours.value.length || !works.value.length) {
    return [];
  }

  return works.value.map(work => {
    // 締切があり、完了していない作品のみ
    if (!work.deadline || work.status === '完了') {
      return null;
    }

    // 推定工数から完了分を引いた残り工数を計算
    // ここでは総推定工数の80%が残っていると仮定（実際の進捗管理は別途実装）
    const totalRemainingHours = work.totalEstimatedHours * 0.8;

    if (totalRemainingHours <= 0) {
      return null;
    }

    const paceCalculation = calculateWorkPace(
      new Date(work.deadline),
      totalRemainingHours,
      0.2, // 20%完了と仮定
      workHours.value,
      holidays.value,
      customDatesStore.customDates
    );

    return {
      work,
      totalRemainingHours,
      paceCalculation
    };
  }).filter((item): item is NonNullable<typeof item> => item !== null);
});

// 最も緊急度の高い作品
const mostUrgentWork = computed(() => {
  const validCalculations = workPaceCalculations.value;
  if (validCalculations.length === 0) return null;

  return validCalculations.reduce((prev, current) => {
    if (!prev) return current;

    // 締切が近い順、そして作業負荷が高い順
    const prevRatio = prev.totalRemainingHours / (prev.paceCalculation.remainingWorkableHours || 1);
    const currentRatio = current.totalRemainingHours / (current.paceCalculation.remainingWorkableHours || 1);

    if (current.paceCalculation.daysUntilDeadline < prev.paceCalculation.daysUntilDeadline) {
      return current;
    }

    if (current.paceCalculation.daysUntilDeadline === prev.paceCalculation.daysUntilDeadline) {
      return currentRatio > prevRatio ? current : prev;
    }

    return prev;
  });
});

// ユーザーが変わったらデータを再読み込み
watch(() => user.value?.uid, async (uid) => {
  if (uid) {
    await settingsStore.fetchWorkHours(uid);
    await worksStore.fetchWorks(uid);
    await customDatesStore.fetchCustomDates(uid);
  }
}, { immediate: true });

// 初期化時に祝日データを読み込み
onMounted(async () => {
  await updateHolidays();
});
</script>

<template>
  <section class="container py-3">
    <div class="mb-4">
      <h1 class="h2 fw-semibold">
        ようこそ<span v-if="displayName">、{{ displayName }}</span
        >！
      </h1>
      <p class="text-muted">Manga Flow Manager のダッシュボードです。</p>
    </div>

    <div class="row g-3">
      <!-- 最優先作品カード -->
      <div v-if="mostUrgentWork" class="col-12 col-md-6 col-xl-4">
        <div class="d-flex align-items-center justify-content-between mb-2">
          <h6 class="mb-0">
            <i class="bi bi-exclamation-triangle me-2"></i>
            最優先作品
          </h6>
          <span class="badge bg-primary">{{ mostUrgentWork.work.title }}</span>
        </div>
        <WorkPaceCard
          :pace-calculation="mostUrgentWork.paceCalculation"
          :total-remaining-hours="mostUrgentWork.totalRemainingHours"
        />
      </div>

      <div class="col-12 col-md-6 col-xl-4">
        <div class="card shadow-sm h-100">
          <div class="card-body">
            <h2 class="card-title h5">最近の作品</h2>
            <p class="card-text text-muted">最近更新した作品や下書きがここに表示されます。</p>
            <button type="button" class="btn btn-primary" disabled>作品を追加</button>
          </div>
        </div>
      </div>

      <div class="col-12 col-md-6 col-xl-4">
        <div class="card shadow-sm h-100">
          <div class="card-body">
            <h2 class="card-title h5">進行中のタスク</h2>
            <p class="card-text text-muted">進捗中のタスクやToDoがここに表示されます。</p>
            <button type="button" class="btn btn-outline-secondary" disabled>タスクを管理</button>
          </div>
        </div>
      </div>

      <div class="col-12 col-md-6 col-xl-4">
        <div class="card shadow-sm h-100">
          <div class="card-body">
            <h2 class="card-title h5">通知</h2>
            <p class="card-text text-muted">新着通知やお知らせがここに表示されます。</p>
            <button type="button" class="btn btn-outline-secondary" disabled>通知センターを見る</button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
