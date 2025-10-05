export const formatDate = (date: Date) => {
  return date.toISOString().split("T")[0];
};

export const isWeekend = (date: Date) => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

/**
 * 指定した年月の1日を取得
 */
export const getFirstDayOfMonth = (year: number, month: number): Date => {
  return new Date(year, month - 1, 1);
};

/**
 * 指定した年月の最終日を取得
 */
export const getLastDayOfMonth = (year: number, month: number): Date => {
  return new Date(year, month, 0);
};

/**
 * 月曜日を週の始まりとした場合の曜日を取得（0=月曜日, 6=日曜日）
 */
export const getMondayBasedDayOfWeek = (date: Date): number => {
  const day = date.getDay();
  return day === 0 ? 6 : day - 1;
};

/**
 * カレンダー表示用の日付配列を生成
 * 月曜日から日曜日の週で構成され、前後の月で埋める
 */
export const generateCalendarDays = (year: number, month: number): Date[] => {
  const firstDay = getFirstDayOfMonth(year, month);
  const lastDay = getLastDayOfMonth(year, month);
  
  // 月の最初の日が月曜日から何日目かを計算
  const firstDayOfWeek = getMondayBasedDayOfWeek(firstDay);
  
  // 月の最後の日が月曜日から何日目かを計算
  const lastDayOfWeek = getMondayBasedDayOfWeek(lastDay);
  
  const days: Date[] = [];
  
  // 前月の日付で最初の週を埋める
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const date = new Date(firstDay);
    date.setDate(date.getDate() - i - 1);
    days.push(date);
  }
  
  // 当月の日付を追加
  const daysInMonth = lastDay.getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(new Date(year, month - 1, day));
  }
  
  // 次月の日付で最後の週を埋める
  const remainingDays = 6 - lastDayOfWeek;
  for (let day = 1; day <= remainingDays; day++) {
    days.push(new Date(year, month, day));
  }
  
  return days;
};

/**
 * 日付が同じ月かどうかを判定
 */
export const isSameMonth = (date1: Date, date2: Date): boolean => {
  return date1.getFullYear() === date2.getFullYear() && 
         date1.getMonth() === date2.getMonth();
};

/**
 * 日付が今日かどうかを判定
 */
export const isToday = (date: Date): boolean => {
  const today = new Date();
  return date.getFullYear() === today.getFullYear() &&
         date.getMonth() === today.getMonth() &&
         date.getDate() === today.getDate();
};
