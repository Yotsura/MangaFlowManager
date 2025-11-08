<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import WorkloadCalendar from './components/WorkloadCalendar.vue';
import WorkHoursForm from '@/modules/settings/components/WorkHoursForm.vue';
import UnavailableTimeModal from './components/UnavailableTimeModal.vue';
import EditModal from '@/components/common/EditModal.vue';
import { getHolidaysWithCabinetOfficeData } from '@/utils/dateUtils';
import type { Holiday } from '@/utils/dateUtils';
import { useSettingsStore } from '@/store/settingsStore';
import { useWorksStore } from '@/store/worksStore';
import { useAuthStore } from '@/store/authStore';
import { useCustomDatesStore } from '@/store/customDatesStore';

interface WorkHoursFormExposed {
  submit: () => void;
  isSaving: () => boolean;
  canSave: () => boolean;
}

const selectedDate = ref<Date | null>(null);
const showDateModal = ref(false);
const showWorkHoursModal = ref(false);
const currentYear = ref(new Date().getFullYear());
const currentMonth = ref(new Date().getMonth() + 1);
const holidays = ref<Holiday[]>([]);

// ストア
const settingsStore = useSettingsStore();
const worksStore = useWorksStore();
const authStore = useAuthStore();
const customDatesStore = useCustomDatesStore();
const { user } = storeToRefs(authStore);
const { works } = storeToRefs(worksStore);

// 作業可能時間設定用
const workHoursRef = ref<WorkHoursFormExposed | null>(null);
const workHoursSaving = computed(() => workHoursRef.value?.isSaving() ?? false);
const workHoursCanSave = computed(() => workHoursRef.value?.canSave() ?? false);

const saveWorkHours = () => {
  workHoursRef.value?.submit();
};

const openWorkHoursModal = () => {
  showWorkHoursModal.value = true;
};

// 締切が設定されている作品のリスト
const worksWithDeadline = computed(() => {
  return works.value
    .filter(work => work.deadline && work.status !== '完了')
    .map(work => {
      const metrics = worksStore.calculateActualWorkHours(work.id);
      return {
        id: work.id,
        title: work.title,
        deadline: work.deadline,
        progressPercentage: metrics.progressPercentage,
        remainingHours: metrics.remainingEstimatedHours,
        totalHours: metrics.totalEstimatedHours
      };
    })
    .sort((a, b) => {
      // 締切の近い順にソート
      return new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime();
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
  showDateModal.value = true;
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
    await customDatesStore.fetchCustomDates(uid);
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
  <section class="container py-3">
    <div class="mb-4 d-flex justify-content-between align-items-center">
      <div>
        <h1 class="h3 fw-semibold mb-1">カレンダー</h1>
        <p class="text-muted mb-0">制作スケジュールや作業不可時間をカレンダーで管理します。</p>
      </div>
      <button class="btn btn-outline-secondary"
        title="作業可能時間の設定" aria-label="作業可能時間の設定"
        @click="openWorkHoursModal">
        <i class="bi bi-gear"></i>
      </button>
    </div>

    <div class="row g-3">
      <div class="col-lg-8 order-2 order-lg-1">
        <WorkloadCalendar
          :year="currentYear"
          :month="currentMonth"
          @date-click="onDateClick"
          @month-change="onMonthChange"
        />
      </div>

      <div class="col-lg-4 order-1 order-lg-2">
        <!-- 締切設定作品リスト -->
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
                  <span class="badge bg-secondary ms-2">{{ new Date(work.deadline!).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/') }}</span>
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
      </div>
    </div>

    <!-- 日付設定モーダル -->
    <UnavailableTimeModal :date="selectedDate" :show="showDateModal" @update:show="showDateModal = $event" @close="showDateModal = false" />

    <!-- 作業可能時間設定モーダル -->
    <EditModal
      :show="showWorkHoursModal"
      title="作業可能時間の設定"
      size="md"
      :can-save="workHoursCanSave"
      :is-saving="workHoursSaving"
      @update:show="showWorkHoursModal = $event"
      @save="saveWorkHours"
      @close="showWorkHoursModal = false"
    >
      <WorkHoursForm ref="workHoursRef" />
    </EditModal>
  </section>
</template>
