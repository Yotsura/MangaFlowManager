import type { Holiday } from './dateUtils';
import { isWeekend, isHoliday } from './dateUtils';

export const calculatePanelsPerDay = (totalPanels: number, remainingDays: number) => {
  if (remainingDays <= 0) {
    return totalPanels;
  }

  return Math.ceil(totalPanels / remainingDays);
};

interface WorkHourRange {
  day: string;
  hours: number;
}

interface WorkPaceCalculation {
  totalWorkableHours: number;
  remainingWorkableHours: number;
  dailyRequiredHours: number;
  todayRequiredHours: number;
  daysUntilDeadline: number;
  workableDaysUntilDeadline: number;
  isOnSchedule: boolean;
  paceStatus: 'ahead' | 'on_track' | 'behind' | 'critical';
}

/**
 * 作業ペースを計算する
 */
export function calculateWorkPace(
  deadline: Date,
  totalRemainingHours: number,
  currentProgress: number,
  workHours: WorkHourRange[],
  holidays: Holiday[] = []
): WorkPaceCalculation {
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDeadline = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());

  // 締切が過去の場合
  if (endOfDeadline < startOfToday) {
    return {
      totalWorkableHours: 0,
      remainingWorkableHours: 0,
      dailyRequiredHours: 0,
      todayRequiredHours: 0,
      daysUntilDeadline: 0,
      workableDaysUntilDeadline: 0,
      isOnSchedule: false,
      paceStatus: 'critical'
    };
  }

  // 作業可能時間マップを作成
  const workHoursMap = new Map<string, number>();
  workHours.forEach(wh => {
    workHoursMap.set(wh.day, wh.hours);
  });

  // 曜日マッピング
  const dayMapping = {
    0: 'sunday',
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
    6: 'saturday'
  } as const;

  // 今日から締切までの作業可能時間を計算
  let totalWorkableHours = 0;
  let remainingWorkableHours = 0;
  let workableDaysCount = 0;

  const currentDate = new Date(startOfToday);

  while (currentDate <= endOfDeadline) {
    const dayOfWeek = currentDate.getDay() as keyof typeof dayMapping;
    const dayKey = dayMapping[dayOfWeek];

    // 祝日チェック
    const isHolidayToday = holidays.some(h =>
      h.date.getFullYear() === currentDate.getFullYear() &&
      h.date.getMonth() === currentDate.getMonth() &&
      h.date.getDate() === currentDate.getDate()
    ) || isHoliday(currentDate);

    let dailyHours = 0;

    if (isHolidayToday) {
      // 祝日の作業時間
      dailyHours = workHoursMap.get('holiday') || 0;
    } else if (isWeekend(currentDate)) {
      // 週末の作業時間
      dailyHours = workHoursMap.get(dayKey) || 0;
    } else {
      // 平日の作業時間
      dailyHours = workHoursMap.get(dayKey) || 0;
    }

    totalWorkableHours += dailyHours;

    // 今日以降の作業可能時間を計算
    if (currentDate >= startOfToday) {
      remainingWorkableHours += dailyHours;
      if (dailyHours > 0) {
        workableDaysCount++;
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  // 今日の作業可能時間
  const todayDayOfWeek = today.getDay() as keyof typeof dayMapping;
  const todayDayKey = dayMapping[todayDayOfWeek];
  const isTodayHoliday = holidays.some(h =>
    h.date.getFullYear() === today.getFullYear() &&
    h.date.getMonth() === today.getMonth() &&
    h.date.getDate() === today.getDate()
  ) || isHoliday(today);

  let todayWorkableHours = 0;
  if (isTodayHoliday) {
    todayWorkableHours = workHoursMap.get('holiday') || 0;
  } else if (isWeekend(today)) {
    todayWorkableHours = workHoursMap.get(todayDayKey) || 0;
  } else {
    todayWorkableHours = workHoursMap.get(todayDayKey) || 0;
  }

  // 必要な進捗計算
  const dailyRequiredHours = workableDaysCount > 0 ? totalRemainingHours / workableDaysCount : 0;
  const todayRequiredHours = Math.min(dailyRequiredHours, todayWorkableHours);

  // 進捗状況判定
  const daysUntilDeadline = Math.ceil((endOfDeadline.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));
  const progressRatio = remainingWorkableHours > 0 ? totalRemainingHours / remainingWorkableHours : 0;

  let paceStatus: 'ahead' | 'on_track' | 'behind' | 'critical' = 'on_track';

  if (remainingWorkableHours === 0 && totalRemainingHours > 0) {
    paceStatus = 'critical';
  } else if (progressRatio > 1.2) {
    paceStatus = 'critical';
  } else if (progressRatio > 1.0) {
    paceStatus = 'behind';
  } else if (progressRatio < 0.8) {
    paceStatus = 'ahead';
  }

  return {
    totalWorkableHours,
    remainingWorkableHours,
    dailyRequiredHours,
    todayRequiredHours,
    daysUntilDeadline,
    workableDaysUntilDeadline: workableDaysCount,
    isOnSchedule: progressRatio <= 1.0,
    paceStatus
  };
}

/**
 * 作業ペースのステータスに応じた色を取得
 */
export function getPaceStatusColor(status: WorkPaceCalculation['paceStatus']): string {
  switch (status) {
    case 'ahead':
      return 'success';
    case 'on_track':
      return 'primary';
    case 'behind':
      return 'warning';
    case 'critical':
      return 'danger';
    default:
      return 'secondary';
  }
}

/**
 * 作業ペースのステータスメッセージを取得
 */
export function getPaceStatusMessage(status: WorkPaceCalculation['paceStatus']): string {
  switch (status) {
    case 'ahead':
      return '予定より進んでいます';
    case 'on_track':
      return '順調に進んでいます';
    case 'behind':
      return '遅れ気味です';
    case 'critical':
      return '要注意：大幅な遅れです';
    default:
      return '状況不明';
  }
}

export type { WorkPaceCalculation, WorkHourRange };
