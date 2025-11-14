import { computed, type ComputedRef } from "vue";
import type { Work } from "@/store/worksStore";
import { useWorksStore } from "@/store/worksStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useCustomDatesStore } from "@/store/customDatesStore";
import { getHolidaysForPeriod } from "@/utils/dateUtils";
import { calculateWorkPace } from "@/utils/workloadUtils";

/**
 * 作品の進捗指標を計算するcomposable
 */
export const useWorkMetrics = (work: ComputedRef<Work | undefined>) => {
  const worksStore = useWorksStore();
  const settingsStore = useSettingsStore();
  const customDatesStore = useCustomDatesStore();

  /**
   * 作品の残り工数（未完了分の推定工数）を計算
   * worksStore.calculateActualWorkHoursを使用
   */
  const remainingEstimatedHours = computed(() => {
    const workData = work.value;
    if (!workData) {
      return 0;
    }

    const actualWorkHours = worksStore.calculateActualWorkHours(workData.id);
    return actualWorkHours.remainingEstimatedHours;
  });

  /**
   * 作業ペース計算の結果を取得
   */
  const workPaceCalculation = computed(() => {
    const workData = work.value;
    if (!workData || !workData.deadline) {
      return null;
    }

    const deadlineDate = new Date(workData.deadline);
    deadlineDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 締切が過去の場合はnull
    if (deadlineDate < today) {
      return null;
    }

    // 作業時間設定を取得
    const workHours = settingsStore.workHours || [];

    // 期間内の祝日を取得
    const holidays = getHolidaysForPeriod(today, deadlineDate);

    // カスタム日付を取得
    const customDates = customDatesStore.customDates || [];

    // calculateWorkPaceを使用して計算
    return calculateWorkPace(
      deadlineDate,
      remainingEstimatedHours.value,
      0, // 進捗率は不要
      workHours,
      holidays,
      customDates
    );
  });

  /**
   * 締切までの作業可能時間を計算
   */
  const availableWorkHours = computed(() => {
    const paceCalc = workPaceCalculation.value;
    if (!paceCalc) {
      return 0;
    }
    return Number(paceCalc.remainingWorkableHours.toFixed(2));
  });

  /**
   * 締切までの1日あたりの必要工数
   * calculateWorkPaceの結果を使用（共通計算）
   */
  const requiredDailyHours = computed(() => {
    const paceCalc = workPaceCalculation.value;
    if (!paceCalc) {
      return 0;
    }

    // calculateWorkPaceで計算されたdailyRequiredHoursを使用
    return paceCalc.dailyRequiredHours;
  });

  /**
   * 締切までの残り日数（カレンダー日数、締切日を含む）
   */
  const daysUntilDeadline = computed(() => {
    const paceCalc = workPaceCalculation.value;
    if (!paceCalc) {
      return 0;
    }
    return paceCalc.daysUntilDeadline;
  });

  return {
    remainingEstimatedHours,
    availableWorkHours,
    requiredDailyHours,
    daysUntilDeadline,
  };
};
