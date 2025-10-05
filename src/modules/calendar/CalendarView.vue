<script setup lang="ts">
import { ref } from 'vue';
import WorkloadCalendar from './components/WorkloadCalendar.vue';

const selectedDate = ref<Date | null>(null);

const onDateClick = (date: Date) => {
  selectedDate.value = date;
  console.log('Selected date:', date);
};

const onMonthChange = (year: number, month: number) => {
  console.log('Month changed:', year, month);
};
</script>

<template>
  <section class="container py-5">
    <div class="mb-4">
      <h1 class="h3 fw-semibold">カレンダー</h1>
      <p class="text-muted">制作スケジュールや作業不可時間をカレンダーで管理します。</p>
    </div>

    <div class="row">
      <div class="col-lg-8">
        <WorkloadCalendar 
          @date-click="onDateClick"
          @month-change="onMonthChange"
        />
      </div>
      
      <div class="col-lg-4">
        <div class="card">
          <div class="card-header">
            <h6 class="card-title mb-0">選択された日付</h6>
          </div>
          <div class="card-body">
            <div v-if="selectedDate" class="text-center">
              <div class="h4 mb-2">{{ selectedDate.getDate() }}</div>
              <div class="text-muted">
                {{ selectedDate.getFullYear() }}年{{ selectedDate.getMonth() + 1 }}月
                {{ ['日', '月', '火', '水', '木', '金', '土'][selectedDate.getDay()] }}曜日
              </div>
            </div>
            <div v-else class="text-muted text-center">
              カレンダーから日付を選択してください
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
