import { computed, type ComputedRef } from "vue";
import type { Work, WorkUnit } from "@/store/worksStore";
import { useSettingsStore } from "@/store/settingsStore";
import { getHolidaysForPeriod } from "@/utils/dateUtils";

/**
 * 作品の進捗指標を計算するcomposable
 */
export const useWorkMetrics = (work: ComputedRef<Work | undefined>) => {
  const settingsStore = useSettingsStore();

  /**
   * 最下位ユニット（リーフノード）を全て取得
   */
  const getAllLeafUnits = (units: WorkUnit[]): WorkUnit[] => {
    const leafUnits: WorkUnit[] = [];

    const collectLeaves = (units: WorkUnit[]) => {
      for (const unit of units) {
        if (unit.stageIndex !== undefined) {
          // stageIndexを持つユニットは最下位
          leafUnits.push(unit);
        } else if (unit.children && unit.children.length > 0) {
          // 子がいる場合は再帰的に探索
          collectLeaves(unit.children);
        }
      }
    };

    collectLeaves(units);
    return leafUnits;
  };

  /**
   * 作品の残り工数（未完了分の推定工数）を計算
   */
  const remainingEstimatedHours = computed(() => {
    const workData = work.value;
    if (!workData || !workData.units || workData.units.length === 0) {
      return 0;
    }

    const leafUnits = getAllLeafUnits(workData.units);
    const stageWorkloads = workData.workStageWorkloads || [];

    if (stageWorkloads.length === 0) {
      return 0;
    }

    // 粒度情報を取得
    const granularities = workData.workGranularities || settingsStore.granularities;
    if (granularities.length === 0) {
      return 0;
    }

    // 最低粒度を取得
    const lowestGranularity = granularities.reduce((min, current) =>
      current.weight < min.weight ? current : min
    );

    // 主要粒度を取得
    const primaryGranularity = granularities.find(g => g.id === workData.primaryGranularityId);
    if (!primaryGranularity) {
      return 0;
    }

    // 残りの工数を計算
    let totalRemainingHours = 0;

    for (const leafUnit of leafUnits) {
      const stageIndex = leafUnit.stageIndex ?? 0;

      // このステージ以降の全ステージの工数を加算
      for (let i = stageIndex; i < stageWorkloads.length; i++) {
        const stage = stageWorkloads[i];
        const baseHours = stage.baseHours ?? 0;

        if (baseHours > 0) {
          // 最低粒度の工数を主要粒度の工数に変換
          const ratio = primaryGranularity.weight / lowestGranularity.weight;
          totalRemainingHours += baseHours * ratio;
        }
      }
    }

    return Number(totalRemainingHours.toFixed(2));
  });

  /**
   * 締切までの作業可能時間を計算
   */
  const availableWorkHours = computed(() => {
    const workData = work.value;
    if (!workData || !workData.deadline) {
      return 0;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const deadlineDate = new Date(workData.deadline);
    deadlineDate.setHours(0, 0, 0, 0);

    // 締切が過ぎている場合は0
    if (deadlineDate <= today) {
      return 0;
    }

    // 作業時間設定を取得
    const workHours = settingsStore.workHours || [];
    const workHoursMap = new Map(workHours.map(wh => [wh.day, wh.hours]));

    // デフォルトの作業時間
    const defaultWeekdayHours = workHoursMap.get("weekday") ?? 8;
    const defaultSaturdayHours = workHoursMap.get("saturday") ?? 0;
    const defaultSundayHours = workHoursMap.get("sunday") ?? 0;
    const defaultHolidayHours = workHoursMap.get("holiday") ?? 0;

    // 期間内の祝日を取得
    const holidays = getHolidaysForPeriod(today, deadlineDate);
    const holidayDates = new Set(
      holidays.map(h => h.date.toISOString().split("T")[0])
    );

    // 日ごとに作業時間を積算
    let totalHours = 0;
    const currentDate = new Date(today);

    while (currentDate < deadlineDate) {
      const dateString = currentDate.toISOString().split("T")[0];
      const dayOfWeek = currentDate.getDay();

      // 祝日かどうか判定
      if (holidayDates.has(dateString)) {
        totalHours += defaultHolidayHours;
      }
      // 日曜日
      else if (dayOfWeek === 0) {
        totalHours += defaultSundayHours;
      }
      // 土曜日
      else if (dayOfWeek === 6) {
        totalHours += defaultSaturdayHours;
      }
      // 平日
      else {
        totalHours += defaultWeekdayHours;
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return Number(totalHours.toFixed(2));
  });

  /**
   * 締切までの1日あたりの必要工数
   */
  const requiredDailyHours = computed(() => {
    const remaining = remainingEstimatedHours.value;
    const available = availableWorkHours.value;

    if (available <= 0) {
      return remaining > 0 ? Infinity : 0;
    }

    return Number((remaining / available).toFixed(2));
  });

  /**
   * 締切までの残り日数（カレンダー日数）
   */
  const daysUntilDeadline = computed(() => {
    const workData = work.value;
    if (!workData || !workData.deadline) {
      return 0;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const deadlineDate = new Date(workData.deadline);
    deadlineDate.setHours(0, 0, 0, 0);

    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays);
  });

  return {
    remainingEstimatedHours,
    availableWorkHours,
    requiredDailyHours,
    daysUntilDeadline,
  };
};
