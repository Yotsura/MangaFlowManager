<script setup lang="ts">
import { watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useWorksStore } from '@/store/worksStore';
import { useCustomDatesStore } from '@/store/customDatesStore';
import WorkPaceCard from '@/modules/calendar/components/WorkPaceCard.vue';
import WorkProgressChart from '@/components/WorkProgressChart.vue';
import { useHolidays } from '@/composables/useHolidays';
import { useUrgentWork } from '@/composables/useUrgentWork';
import { useTestDataGenerator } from '@/composables/useTestDataGenerator';

const authStore = useAuthStore();
const settingsStore = useSettingsStore();
const worksStore = useWorksStore();
const customDatesStore = useCustomDatesStore();

const { displayName, user } = storeToRefs(authStore);

// 祝日データを管理
const { holidays } = useHolidays();

// 最優先作品を計算
const { mostUrgentWork } = useUrgentWork(holidays.value);

// テストデータ生成機能
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { generateTestData } = useTestDataGenerator();

// ユーザーが変わったらデータを再読み込み
watch(() => user.value?.uid, async (uid) => {
  if (uid) {
    await settingsStore.fetchWorkHours(uid);
    await worksStore.fetchWorks(uid);
    await customDatesStore.fetchCustomDates(uid);
  }
}, { immediate: true });
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
      <!-- 進捗グラフ -->
      <div class="col-12">
        <div class="card shadow-sm">
          <div class="card-header bg-white d-flex justify-content-between align-items-center">
            <h5 class="mb-0">作品別 進捗集計</h5>
            <!-- 開発用: テストデータ生成ボタン -->
            <!-- <button class="btn btn-sm btn-outline-secondary"
              @click="generateTestData" title="全作品にサンプルデータを生成">
              <i class="bi bi-database-fill-add me-1"></i>
              テストデータ生成
            </button> -->
          </div>
          <div class="card-body">
            <WorkProgressChart />
          </div>
        </div>
      </div>

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
