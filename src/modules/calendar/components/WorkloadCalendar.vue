<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { generateCalendarDays, isSameMonth, isToday, isWeekend } from '@/utils/dateUtils';

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

const currentYear = ref(props.year);
const currentMonth = ref(props.month);

// カレンダーの日付配列を生成
const calendarDays = computed(() => {
  return generateCalendarDays(currentYear.value, currentMonth.value);
});

// 現在の月の参照日（月判定用）
const currentMonthDate = computed(() => {
  return new Date(currentYear.value, currentMonth.value - 1, 1);
});

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

// 日付セルのクラスを取得
const getDateCellClass = (date: Date) => {
  const classes = ['calendar-date'];
  
  if (!isSameMonth(date, currentMonthDate.value)) {
    classes.push('other-month');
  }
  
  if (isToday(date)) {
    classes.push('today');
  }
  
  if (isWeekend(date)) {
    classes.push('weekend');
  }
  
  return classes.join(' ');
};

// propsが変更された時の処理
watch(() => [props.year, props.month], ([newYear, newMonth]) => {
  if (newYear !== undefined) currentYear.value = newYear;
  if (newMonth !== undefined) currentMonth.value = newMonth;
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
              >
                {{ calendarDays[weekIndex * 7 + dayIndex - 1]!.getDate() }}
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
  height: 60px;
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
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
  cursor: pointer;
  font-size: 0.875rem;
}

.calendar-date:hover {
  background-color: #f8f9fa;
}

.calendar-date.other-month {
  color: #adb5bd;
}

.calendar-date.today {
  background-color: #0d6efd;
  color: white;
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
</style>
