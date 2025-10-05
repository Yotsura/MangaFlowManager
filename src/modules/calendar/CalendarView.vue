<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import WorkloadCalendar from './components/WorkloadCalendar.vue';
import { isHoliday, isWeekend, getHolidaysWithCabinetOfficeData } from '@/utils/dateUtils';
import type { Holiday } from '@/utils/dateUtils';

const selectedDate = ref<Date | null>(null);
const currentYear = ref(new Date().getFullYear());
const currentMonth = ref(new Date().getMonth() + 1);
const holidays = ref<Holiday[]>([]);

const selectedDateInfo = computed(() => {
  if (!selectedDate.value) return null;

  const date = selectedDate.value;
  const holiday = getHolidayForDate(date);
  const weekend = isWeekend(date);

  return {
    date,
    holiday,
    weekend,
    dayOfWeek: ['日', '月', '火', '水', '木', '金', '土'][date.getDay()]
  };
});

// 祝日を取得（内閣府データ優先）
const getHolidayForDate = (date: Date): Holiday | null => {
  const holiday = holidays.value.find(h =>
    h.date.getFullYear() === date.getFullYear() &&
    h.date.getMonth() === date.getMonth() &&
    h.date.getDate() === date.getDate()
  );

  // 内閣府データにない場合は計算ベースにフォールバック
  return holiday || isHoliday(date);
};

// 現在表示中の月の祝日一覧を取得
const currentMonthHolidays = computed(() => {
  return holidays.value.filter((holiday: Holiday) => {
    const holidayMonth = holiday.date.getMonth() + 1;
    return holidayMonth === currentMonth.value;
  }).sort((a: Holiday, b: Holiday) => a.date.getDate() - b.date.getDate());
});

// 祝日データを更新
const updateHolidays = async () => {
  try {
    const yearHolidays = await getHolidaysWithCabinetOfficeData(currentYear.value);
    holidays.value = yearHolidays;
  } catch (error) {
    console.warn('Failed to update holidays:', error);
  }
};

const onDateClick = (date: Date) => {
  selectedDate.value = date;
  console.log('Selected date:', date);
};

const onMonthChange = async (year: number, month: number) => {
  const yearChanged = currentYear.value !== year;
  currentYear.value = year;
  currentMonth.value = month;

  // 年が変わった場合は祝日データを更新
  if (yearChanged) {
    await updateHolidays();
  }

  console.log('Month changed:', year, month);
};

// 年が変わったら祝日データを更新
watch(() => currentYear.value, async () => {
  await updateHolidays();
});

// 初期化時に祝日データを読み込み
onMounted(async () => {
  await updateHolidays();
});
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
          :year="currentYear"
          :month="currentMonth"
          @date-click="onDateClick"
          @month-change="onMonthChange"
        />
      </div>

      <div class="col-lg-4">
        <!-- 選択された日付情報 -->
        <div class="card mb-4">
          <div class="card-header">
            <h6 class="card-title mb-0">選択された日付</h6>
          </div>
          <div class="card-body">
            <div v-if="selectedDateInfo" class="text-center">
              <div class="h4 mb-2">{{ selectedDateInfo.date.getDate() }}</div>
              <div class="text-muted mb-3">
                {{ selectedDateInfo.date.getFullYear() }}年{{ selectedDateInfo.date.getMonth() + 1 }}月
                {{ selectedDateInfo.dayOfWeek }}曜日
              </div>

              <div v-if="selectedDateInfo.holiday" class="alert alert-danger py-2 mb-2">
                <i class="bi bi-calendar-event me-1"></i>
                {{ selectedDateInfo.holiday.name }}
              </div>

              <div v-else-if="selectedDateInfo.weekend" class="alert alert-warning py-2 mb-2">
                <i class="bi bi-calendar-x me-1"></i>
                週末
              </div>

              <div v-else class="alert alert-success py-2 mb-2">
                <i class="bi bi-calendar-check me-1"></i>
                平日
              </div>
            </div>
            <div v-else class="text-muted text-center">
              カレンダーから日付を選択してください
            </div>
          </div>
        </div>

        <!-- 今月の祝日一覧 -->
        <div class="card">
          <div class="card-header">
            <h6 class="card-title mb-0">
              <i class="bi bi-calendar-event me-2"></i>
              {{ currentYear }}年{{ currentMonth }}月の祝日
            </h6>
          </div>
          <div class="card-body">
            <div v-if="currentMonthHolidays.length > 0">
              <div
                v-for="(holiday, index) in currentMonthHolidays"
                :key="holiday.date.getTime()"
                class="d-flex justify-content-between align-items-center py-2"
                :class="{ 'border-bottom': index < currentMonthHolidays.length - 1 }"
              >
                <div>
                  <div class="fw-medium">{{ holiday.name }}</div>
                  <small class="text-muted">
                    {{ holiday.date.getMonth() + 1 }}月{{ holiday.date.getDate() }}日
                    ({{ ['日', '月', '火', '水', '木', '金', '土'][holiday.date.getDay()] }})
                  </small>
                </div>
                <span class="badge bg-danger">祝日</span>
              </div>
            </div>
            <div v-else class="text-muted text-center py-3">
              <i class="bi bi-calendar-x fs-1 d-block mb-2 opacity-50"></i>
              この月に祝日はありません
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
