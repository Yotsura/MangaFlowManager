<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { generateCalendarDays, isSameMonth, isToday, isWeekend, isHoliday, getHolidaysWithCabinetOfficeData, formatLocalDate } from '@/utils/dateUtils';
import type { Holiday } from '@/utils/dateUtils';
import { useCustomDatesStore } from '@/store/customDatesStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useWorksStore } from '@/store/worksStore';

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
const worksStore = useWorksStore();
const { workHours } = storeToRefs(settingsStore);
const { works } = storeToRefs(worksStore);

const currentYear = ref(props.year);
const currentMonth = ref(props.month);
const holidays = ref<Holiday[]>([]);
const holidaysLastUpdated = ref<number>(0);

// カレンダーの日付配列を生成
const calendarDays = computed(() => {
  return generateCalendarDays(currentYear.value, currentMonth.value);
});

// 週ごとにグループ化した日付配列
const calendarWeeks = computed(() => {
  const days = calendarDays.value;
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
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
const weekDays = ['日', '月', '火', '水', '木', '金', '土'];

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
  } else if (customDate?.type === "custom-hours") {
    classes.push('custom-hours');
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

  // 締め切りがある日付
  if (getDeadlineWork(date)) {
    classes.push('has-deadline');
  }

  return classes.join(' ');
};

// 祝日名を取得
const getHolidayName = (date: Date) => {
  const holiday = getHolidayForDate(date);
  return holiday ? holiday.name : null;
};

// カスタム日付情報を取得
const getCustomDateInfo = (date: Date) => {
  const dateString = formatLocalDate(date);
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
    case "custom-hours":
      return "固有作業時間";
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

  // 固有作業時間が設定されている場合
  if (customDate?.type === "custom-hours" && customDate.customHours !== undefined) {
    return customDate.customHours;
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

// 指定日が締切の作品を取得（最初の1作品のみ）
const getDeadlineWork = (date: Date): string | null => {
  const dateString = formatLocalDate(date);
  const work = works.value.find(
    work => work.deadline === dateString && work.status !== '完了'
  );
  return work ? work.title : null;
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
        <div class="row g-0 calendar-week"
          v-for="(week, weekIndex) in calendarWeeks" :key="weekIndex" >
          <div class="col calendar-cell"
            v-for="(date, dayIndex) in week" :key="dayIndex">
            <template v-if="date">
              <button
                :class="getDateCellClass(date)"
                :title="getHolidayName(date) || ''"
                @click="onDateClick(date)">
                <div class="date-number">{{ date.getDate() }}</div>
                <div class="label-area">
                  <div v-if="getHolidayName(date)" class="holiday-name">
                    {{ getHolidayName(date) }}
                  </div>
                  <div v-if="getCustomDateLabel(date)" class="custom-label">
                    {{ getCustomDateLabel(date) }}
                  </div>
                </div>
                <div class="work-hours">
                  {{ getWorkHoursForDate(date).toFixed(1) }}h
                </div>
                <div class="deadline-label">
                  <template v-if="getDeadlineWork(date)">〆</template>
                  {{ getDeadlineWork(date) }}
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

/* ===== 日付セル ===== */
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

/* ===== 他の月の日付 ===== */
.calendar-date.other-month {
  color: #adb5bd;
}

.calendar-date.other-month:hover,
.calendar-date.other-month.weekend:hover,
.calendar-date.other-month.holiday:hover {
  background-color: #f8f9fa;
}

.calendar-date.other-month.weekend,
.calendar-date.other-month.holiday {
  background-color: transparent;
  color: #f5c2c7;
}

/* ===== 今日の日付 ===== */
.calendar-date.today {
  position: relative;
}

.calendar-date.today .date-number {
  background-color: #baacfc;
  color: white;
  font-weight: bold;
  border-radius: 50%;
  width: 25px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  transition: background-color 0.2s ease;
}

.calendar-date.today:hover .date-number {
  background-color: #a293e9;
}

/* ===== 週末・祝日（赤い背景色グループ） ===== */
.calendar-date.weekend,
.calendar-date.holiday,
.calendar-date.custom-holiday {
  background-color: #fdf2f2;
  color: #dc3545;
}

.calendar-date.weekend:hover,
.calendar-date.holiday:hover,
.calendar-date.custom-holiday:hover {
  background-color: #f5c2c7;
}

/* ===== 作業不可 ===== */
.calendar-date.unavailable {
  background-color: #f8d7da;
  color: #721c24;
  text-decoration: line-through;
}

.calendar-date.unavailable:hover {
  background-color: #f5c2c7;
}

/* ===== 固有作業時間 ===== */
.calendar-date.custom-hours {
  background-color: #d1ecf1;
  color: #0c5460;
  font-weight: 500;
}

.calendar-date.custom-hours:hover {
  background-color: #bee5eb;
}

/* ===== 締切日（赤い背景色） ===== */
.calendar-date.has-deadline {
  background-color: #ff6666;
  color: white;
}

.calendar-date.has-deadline:hover {
  background-color: #ff4d4d;
}

.calendar-date.has-deadline .work-hours,
.calendar-date.has-deadline .deadline-label {
  color: white;
}

/* ===== セル内要素 ===== */
.date-number {
  font-weight: 500;
  line-height: 1;
  min-height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.label-area {
  min-height: 16px;
  margin-top: 1px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.holiday-name {
  font-size: 0.6rem;
  line-height: 0.8;
  text-align: center;
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
  font-weight: 600;
  padding: 1px 3px;
  background-color: #ffc107;
  color: #000;
  border-radius: 2px;
  display: inline-block;
}

.calendar-date.unavailable .custom-label {
  background-color: #dc3545;
  color: white;
}

.calendar-date.custom-hours .custom-label {
  background-color: #17a2b8;
  color: white;
}

.work-hours {
  font-size: 0.65rem;
  line-height: 0.8;
  text-align: center;
  margin-top: 2px;
  font-weight: 500;
  color: #000;
  min-height: 14px;
}

.deadline-label {
  font-size: 0.55rem;
  line-height: 0.9;
  text-align: center;
  margin-top: 2px;
  font-weight: 600;
  color: #dc3545;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 2px;
}
</style>
