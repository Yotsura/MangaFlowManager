<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import WorkloadCalendar from './components/WorkloadCalendar.vue';
import WorkHoursForm from '@/modules/settings/components/WorkHoursForm.vue';
import { getHolidaysWithCabinetOfficeData } from '@/utils/dateUtils';
import type { Holiday } from '@/utils/dateUtils';

interface WorkHoursFormExposed {
  submit: () => void;
  isSaving: () => boolean;
  canSave: () => boolean;
}

const selectedDate = ref<Date | null>(null);
const currentYear = ref(new Date().getFullYear());
const currentMonth = ref(new Date().getMonth() + 1);
const holidays = ref<Holiday[]>([]);

// 作業可能時間設定用
const workHoursRef = ref<WorkHoursFormExposed | null>(null);
const workHoursSaving = computed(() => workHoursRef.value?.isSaving() ?? false);
const workHoursCanSave = computed(() => workHoursRef.value?.canSave() ?? false);

const saveWorkHours = () => {
  workHoursRef.value?.submit();
};



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
        <!-- 作業可能時間の設定 -->
        <div class="card">
          <div class="card-header">
            <div class="d-flex align-items-center justify-content-between">
              <h6 class="card-title mb-0">
                <i class="bi bi-clock me-2"></i>
                作業可能時間の設定
              </h6>
              <button class="btn btn-primary btn-sm" type="button" :disabled="workHoursSaving || !workHoursCanSave" @click="saveWorkHours">
                {{ workHoursSaving ? "保存中..." : "設定を保存" }}
              </button>
            </div>
          </div>
          <div class="card-body p-3">
            <WorkHoursForm ref="workHoursRef" />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
