import { ref, onMounted } from 'vue';
import { getHolidaysWithCabinetOfficeData } from '@/utils/dateUtils';
import type { Holiday } from '@/utils/dateUtils';

/**
 * 祝日データを管理するcomposable
 */
export function useHolidays(year?: number) {
  const currentYear = ref(year ?? new Date().getFullYear());
  const holidays = ref<Holiday[]>([]);

  // 祝日データを更新
  const updateHolidays = async () => {
    try {
      const yearHolidays = await getHolidaysWithCabinetOfficeData(currentYear.value);
      holidays.value = yearHolidays;
    } catch (error) {
      console.warn('Failed to update holidays:', error);
    }
  };

  // 初期化時に祝日データを読み込み
  onMounted(async () => {
    await updateHolidays();
  });

  return {
    currentYear,
    holidays,
    updateHolidays
  };
}
