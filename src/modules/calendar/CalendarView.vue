<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import WorkloadCalendar from './components/WorkloadCalendar.vue';
import WorkHoursForm from '@/modules/settings/components/WorkHoursForm.vue';
import WorkPaceCard from './components/WorkPaceCard.vue';
import { getHolidaysWithCabinetOfficeData } from '@/utils/dateUtils';
import type { Holiday } from '@/utils/dateUtils';
import { calculateWorkPace } from '@/utils/workloadUtils';
import { useSettingsStore } from '@/store/settingsStore';
import { useWorksStore } from '@/store/worksStore';
import { useAuthStore } from '@/store/authStore';

interface WorkHoursFormExposed {
  submit: () => void;
  isSaving: () => boolean;
  canSave: () => boolean;
}

const selectedDate = ref<Date | null>(null);
const currentYear = ref(new Date().getFullYear());
const currentMonth = ref(new Date().getMonth() + 1);
const holidays = ref<Holiday[]>([]);

// ストア
const settingsStore = useSettingsStore();
const worksStore = useWorksStore();
const authStore = useAuthStore();
const { user } = storeToRefs(authStore);
const { workHours } = storeToRefs(settingsStore);
const { works } = storeToRefs(worksStore);

// 作業可能時間設定用
const workHoursRef = ref<WorkHoursFormExposed | null>(null);
const workHoursSaving = computed(() => workHoursRef.value?.isSaving() ?? false);
const workHoursCanSave = computed(() => workHoursRef.value?.canSave() ?? false);

const saveWorkHours = () => {
  workHoursRef.value?.submit();
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
      holidays.value
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

// ユーザーが変わったらデータを再読み込み
watch(() => user.value?.uid, async (uid) => {
  if (uid) {
    await settingsStore.fetchWorkHours(uid);
    await worksStore.fetchWorks(uid);
  }
}, { immediate: true });

// 初期化時に祝日データを読み込み
onMounted(async () => {
  await updateHolidays();

  // ユーザーデータを読み込み
  if (user.value?.uid) {
    await settingsStore.fetchWorkHours(user.value.uid);
    await worksStore.fetchWorks(user.value.uid);
  }
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
        <!-- 作業ペース表示 -->
        <div v-if="mostUrgentWork" class="mb-4">
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
