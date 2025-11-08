<script setup lang="ts">
/**
 * 締切設定作品リストコンポーネント
 *
 * 締切が設定されている未完了作品を、締切日の近い順に表示します。
 * 各作品について以下の情報を表示:
 * - 作品タイトル
 * - 締切までの残り日数と作業可能時間
 * - 締切日（日本語形式）
 * - 進捗率
 * - 残り推定工数と総工数
 *
 * @see useDeadlineWorks - 締切作品データの取得と計算を行うcomposable
 * @see formatJapaneseDate - 日付の日本語フォーマット（YYYY/MM/DD）
 */
import { formatJapaneseDate } from '@/utils/dateUtils';
import { useDeadlineWorks } from '@/composables/useDeadlineWorks';

const { worksWithDeadline } = useDeadlineWorks();
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
              <span class="badge bg-secondary">{{ formatJapaneseDate(work.deadline!) }}</span>
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
