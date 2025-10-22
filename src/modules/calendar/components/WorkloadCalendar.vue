<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { generateCalendarDays, isSameMonth, isToday, isWeekend, isHoliday, getHolidaysWithCabinetOfficeData } from '@/utils/dateUtils';
import type { Holiday } from '@/utils/dateUtils';
import { useCustomDatesStore } from '@/store/customDatesStore';
import { useSettingsStore } from '@/store/settingsStore';

interface Props {
  year?: number;
  month?: number;
}

const props = withDefaults(defineProps<Props>(), {
  year: () => new Date().getFullYear(),
  month: () => new Date().getMonth() + 1
});

const emit = defineEmits<{
  'date-click': [date: Date];
  'month-change': [year: number, month: number];
}>();

const customDatesStore = useCustomDatesStore();
const settingsStore = useSettingsStore();
const { workHours } = storeToRefs(settingsStore);

const currentYear = ref(props.year);
const currentMonth = ref(props.month);
const holidays = ref<Holiday[]>([]);
const holidaysLastUpdated = ref<number>(0);

// カレンダーの日付配列を生成
const calendarDays = computed(() => {
  return generateCalendarDays(currentYear.value, currentMonth.value);
});

// 現在の月の参照日（月判定用）
const currentMonthDate = computed(() => {
  return new Date(currentYear.value, currentMonth.value - 1, 1);
});

// 祝日データを更新
const updateHolidays = async () => {
  try {
    const yearHolidays = await getHolidaysWithCabinetOfficeData(currentYear.value);
    holidays.value = yearHolidays;
    holidaysLastUpdated.value = Date.now();
  } catch (error) {
    console.warn('Failed to update holidays:', error);
  }
};

// 曜日ラベル
const weekDays = ['月', '火', '水', '木', '金', '土', '日'];

// 月を変更
const changeMonth = (delta: number) => {
  const newDate = new Date(currentYear.value, currentMonth.value - 1 + delta, 1);
  currentYear.value = newDate.getFullYear();
  currentMonth.value = newDate.getMonth() + 1;
  emit('month-change', currentYear.value, currentMonth.value);
};

// 日付クリック
const onDateClick = (date: Date) => {
  emit('date-click', date);
};

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

// 日付セルのクラスを取得
const getDateCellClass = (date: Date) => {
  const classes = ['calendar-date'];

  if (!isSameMonth(date, currentMonthDate.value)) {
    classes.push('other-month');
  }

  if (isToday(date)) {
    classes.push('today');
  }

  // カスタム日付を確認
  const customDate = getCustomDateInfo(date);

  if (customDate?.type === "unavailable") {
    classes.push('unavailable');
  } else if (customDate?.type === "custom-holiday") {
    classes.push('custom-holiday');
  } else {
    // カスタム日付がない場合のみ通常の祝日判定
    const holiday = getHolidayForDate(date);
    if (holiday) {
      classes.push('holiday');
    }

    if (isWeekend(date)) {
      classes.push('weekend');
    }
  }

  return classes.join(' ');
};

// 祝日名を取得
const getHolidayName = (date: Date) => {
  const holiday = getHolidayForDate(date);
  return holiday ? holiday.name : null;
};

// 日本時間でYYYY-MM-DD形式の文字列を取得
const getLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// カスタム日付情報を取得
const getCustomDateInfo = (date: Date) => {
  const dateString = getLocalDateString(date);
  return customDatesStore.getCustomDateByDate(dateString);
};

// カスタム日付のラベルを取得
const getCustomDateLabel = (date: Date) => {
  const customDate = getCustomDateInfo(date);
  if (!customDate) return null;

  switch (customDate.type) {
    case "custom-holiday":
      return "任意休日";
    case "unavailable":
      return "作業不可";
    default:
      return null;
  }
};

// 作業可能時間を取得
const getWorkHoursForDate = (date: Date): number => {
  const customDate = getCustomDateInfo(date);
  const workHoursMap = new Map(workHours.value.map(wh => [wh.day, wh.hours]));

  // 作業不可が設定されている場合は0
  if (customDate?.type === "unavailable") {
    return 0;
  }

  // 任意休日または実際の祝日の場合
  const holiday = getHolidayForDate(date);
  if (customDate?.type === "custom-holiday" || holiday) {
    return workHoursMap.get("holiday") ?? 0;
  }

  // 曜日マッピング
  const dayMapping: Record<number, string> = {
    0: 'sunday',
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
    6: 'saturday'
  };

  const dayKey = dayMapping[date.getDay()];
  return workHoursMap.get(dayKey) ?? 0;
};

// 年が変わったら祝日データを更新
watch(() => currentYear.value, async () => {
  await updateHolidays();
});

// propsが変更された時の処理
watch(() => [props.year, props.month], ([newYear, newMonth]) => {
  if (newYear !== undefined) currentYear.value = newYear;
  if (newMonth !== undefined) currentMonth.value = newMonth;
});

// 初期化時に祝日データを読み込み
onMounted(async () => {
  await updateHolidays();
});
</script>

<template>
  <div class="workload-calendar border rounded bg-white shadow-sm">
    <!-- カレンダーヘッダー -->
    <div class="calendar-header d-flex justify-content-between align-items-center p-3 border-bottom">
      <button
        class="btn btn-outline-secondary btn-sm"
        @click="changeMonth(-1)"
        aria-label="前の月"
      >
        <i class="bi bi-chevron-left"></i>
      </button>

      <h5 class="mb-0 fw-semibold">
        {{ currentYear }}年 {{ currentMonth }}月
      </h5>

      <button
        class="btn btn-outline-secondary btn-sm"
        @click="changeMonth(1)"
        aria-label="次の月"
      >
        <i class="bi bi-chevron-right"></i>
      </button>
    </div>

    <!-- カレンダー本体 -->
    <div class="calendar-body p-3">
      <!-- 曜日ヘッダー -->
      <div class="calendar-weekdays row g-0 mb-2">
        <div
          v-for="weekDay in weekDays"
          :key="weekDay"
          class="col calendar-weekday text-center py-2 fw-semibold text-muted"
        >
          {{ weekDay }}
        </div>
      </div>

      <!-- 日付グリッド -->
      <div class="calendar-dates">
        <div
          v-for="(week, weekIndex) in Math.ceil(calendarDays.length / 7)"
          :key="weekIndex"
          class="row g-0 calendar-week"
        >
          <div
            v-for="dayIndex in 7"
            :key="dayIndex"
            class="col calendar-cell"
          >
            <template v-if="calendarDays[weekIndex * 7 + dayIndex - 1]">
              <button
                v-if="calendarDays[weekIndex * 7 + dayIndex - 1]"
                :class="getDateCellClass(calendarDays[weekIndex * 7 + dayIndex - 1]!)"
                @click="onDateClick(calendarDays[weekIndex * 7 + dayIndex - 1]!)"
                :title="getHolidayName(calendarDays[weekIndex * 7 + dayIndex - 1]!) || ''"
              >
                <div class="date-number">
                  {{ calendarDays[weekIndex * 7 + dayIndex - 1]!.getDate() }}
                </div>
                <div
                  v-if="getHolidayName(calendarDays[weekIndex * 7 + dayIndex - 1]!)"
                  class="holiday-name"
                >
                  {{ getHolidayName(calendarDays[weekIndex * 7 + dayIndex - 1]!) }}
                </div>
                <div
                  v-if="getCustomDateLabel(calendarDays[weekIndex * 7 + dayIndex - 1]!)"
                  class="custom-label"
                >
                  {{ getCustomDateLabel(calendarDays[weekIndex * 7 + dayIndex - 1]!) }}
                </div>
                <div class="work-hours">
                  {{ getWorkHoursForDate(calendarDays[weekIndex * 7 + dayIndex - 1]!).toFixed(1) }}h
                </div>
              </button>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.calendar-weekday {
  font-size: 0.875rem;
}

.calendar-cell {
  height: 80px;
  border-right: 1px solid #e9ecef;
  border-bottom: 1px solid #e9ecef;
}

.calendar-cell:last-child {
  border-right: none;
}

.calendar-week:last-child .calendar-cell {
  border-bottom: none;
}

.calendar-date {
  width: 100%;
  height: 100%;
  border: none;
  background: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
  cursor: pointer;
  font-size: 0.875rem;
  padding: 2px;
}

.calendar-date:hover {
  background-color: #f8f9fa;
}

.calendar-date.other-month {
  color: #adb5bd;
}

.calendar-date.today {
  background-color: #0d6efd;
  color: #000;
  font-weight: bold;
  border-radius: 4px;
}

.calendar-date.today:hover {
  background-color: #0b5ed7;
}

.calendar-date.weekend {
  color: #dc3545;
}

.calendar-date.other-month.weekend {
  color: #f5c2c7;
}

.calendar-date.holiday {
  background-color: #fdf2f2;
  color: #dc3545;
}

.calendar-date.holiday:hover {
  background-color: #f5c2c7;
}

.calendar-date.other-month.holiday {
  background-color: transparent;
  color: #f5c2c7;
}

.calendar-date.custom-holiday {
  background-color: #fff3cd;
  color: #856404;
}

.calendar-date.custom-holiday:hover {
  background-color: #ffe69c;
}

.calendar-date.unavailable {
  background-color: #f8d7da;
  color: #721c24;
  text-decoration: line-through;
}

.calendar-date.unavailable:hover {
  background-color: #f5c2c7;
}

.date-number {
  font-weight: 500;
  line-height: 1;
}

.holiday-name {
  font-size: 0.6rem;
  line-height: 0.8;
  text-align: center;
  margin-top: 1px;
  font-weight: 400;
  word-break: break-all;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}

.custom-label {
  font-size: 0.6rem;
  line-height: 0.8;
  text-align: center;
  margin-top: 1px;
  font-weight: 600;
  padding: 1px 3px;
  background-color: #ffc107;
  color: #000;
  border-radius: 2px;
}

.calendar-date.unavailable .custom-label {
  background-color: #dc3545;
  color: white;
}

.work-hours {
  font-size: 0.65rem;
  line-height: 0.8;
  text-align: center;
  margin-top: 2px;
  font-weight: 500;
  color: #000;
}
</style>
