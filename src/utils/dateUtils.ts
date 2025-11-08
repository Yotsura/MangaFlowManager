export const formatDate = (date: Date) => {
  return date.toISOString().split("T")[0];
};

/**
 * 日本時間（ローカルタイム）でYYYY-MM-DD形式の文字列を取得
 * toISOString()はUTC時間になるため、ローカル時間で正確に日付を取得するために使用
 */
export const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * 日付を日本語形式（YYYY/MM/DD）でフォーマット
 */
export const formatJapaneseDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).replace(/\//g, '/');
};

/**
 * 日付文字列（YYYY-MM-DD）に指定日数を加算
 */
export const addDays = (dateStr: string, days: number): string => {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

/**
 * 2つの日付文字列（YYYY-MM-DD）の間の全日付を取得
 * @param startDate 開始日（含む）
 * @param endDate 終了日（含む）
 * @returns 日付文字列の配列
 */
export const getDateRange = (startDate: string, endDate: string): string[] => {
  const dates: string[] = [];
  let currentDate = startDate;

  while (currentDate <= endDate) {
    dates.push(currentDate);
    currentDate = addDays(currentDate, 1);
  }

  return dates;
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
 * 日曜日から土曜日の週で構成され、前後の月で埋める
 */
export const generateCalendarDays = (year: number, month: number): Date[] => {
  const firstDay = getFirstDayOfMonth(year, month);
  const lastDay = getLastDayOfMonth(year, month);

  // 月の最初の日が日曜日から何日目かを計算（0=日曜日, 6=土曜日）
  const firstDayOfWeek = firstDay.getDay();

  // 月の最後の日が日曜日から何日目かを計算
  const lastDayOfWeek = lastDay.getDay();

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

/**
 * 祝日情報の型定義
 */
export interface Holiday {
  name: string;
  date: Date;
}

/**
 * 春分の日を計算（2000年以降の計算式）
 */
const calculateVernalEquinox = (year: number): number => {
  if (year >= 2000 && year <= 2099) {
    return Math.floor(20.8431 + 0.242194 * (year - 1851) - Math.floor((year - 1851) / 4));
  } else if (year >= 1900 && year <= 1999) {
    return Math.floor(21.2422 + 0.242194 * (year - 1851) - Math.floor((year - 1851) / 4));
  }
  return 20; // fallback
};

/**
 * 秋分の日を計算（2000年以降の計算式）
 */
const calculateAutumnalEquinox = (year: number): number => {
  if (year >= 2000 && year <= 2099) {
    return Math.floor(23.2488 + 0.242194 * (year - 1851) - Math.floor((year - 1851) / 4));
  } else if (year >= 1900 && year <= 1999) {
    return Math.floor(23.7422 + 0.242194 * (year - 1851) - Math.floor((year - 1851) / 4));
  }
  return 23; // fallback
};

/**
 * n番目の月曜日を取得
 */
const getNthMonday = (year: number, month: number, nth: number): number => {
  const firstDay = new Date(year, month - 1, 1);
  const firstMonday = firstDay.getDay() === 1 ? 1 : 8 - firstDay.getDay() + 1;
  return firstMonday + (nth - 1) * 7;
};

/**
 * 指定年の祝日を計算で取得
 */
export const getHolidays = (year: number): Holiday[] => {
  const holidays: Holiday[] = [];

  // 元日
  holidays.push({ name: '元日', date: new Date(year, 0, 1) });

  // 成人の日（1月第2月曜日、2000年以降）
  if (year >= 2000) {
    const comingOfAgeDay = getNthMonday(year, 1, 2);
    holidays.push({ name: '成人の日', date: new Date(year, 0, comingOfAgeDay) });
  } else {
    holidays.push({ name: '成人の日', date: new Date(year, 0, 15) });
  }

  // 建国記念の日
  holidays.push({ name: '建国記念の日', date: new Date(year, 1, 11) });

  // 天皇誕生日
  if (year >= 2020) {
    holidays.push({ name: '天皇誕生日', date: new Date(year, 1, 23) });
  } else if (year >= 1989) {
    holidays.push({ name: '天皇誕生日', date: new Date(year, 11, 23) });
  }

  // 春分の日
  const vernalEquinox = calculateVernalEquinox(year);
  holidays.push({ name: '春分の日', date: new Date(year, 2, vernalEquinox) });

  // 昭和の日（2007年以降）
  if (year >= 2007) {
    holidays.push({ name: '昭和の日', date: new Date(year, 3, 29) });
  } else if (year >= 1989) {
    holidays.push({ name: 'みどりの日', date: new Date(year, 3, 29) });
  }

  // 憲法記念日
  holidays.push({ name: '憲法記念日', date: new Date(year, 4, 3) });

  // みどりの日
  if (year >= 2007) {
    holidays.push({ name: 'みどりの日', date: new Date(year, 4, 4) });
  }

  // こどもの日
  holidays.push({ name: 'こどもの日', date: new Date(year, 4, 5) });

  // 海の日（7月第3月曜日、2003年以降）
  if (year >= 2021) {
    // 2021年は五輪特例で7月22日
    holidays.push({ name: '海の日', date: new Date(year, 6, 22) });
  } else if (year >= 2003) {
    const marineDay = getNthMonday(year, 7, 3);
    holidays.push({ name: '海の日', date: new Date(year, 6, marineDay) });
  } else if (year >= 1996) {
    holidays.push({ name: '海の日', date: new Date(year, 6, 20) });
  }

  // 山の日（2016年以降）
  if (year >= 2021) {
    // 2021年は五輪特例で8月8日
    holidays.push({ name: '山の日', date: new Date(year, 7, 8) });
  } else if (year >= 2016) {
    holidays.push({ name: '山の日', date: new Date(year, 7, 11) });
  }

  // 敬老の日（9月第3月曜日、2003年以降）
  if (year >= 2003) {
    const respectForTheAgedDay = getNthMonday(year, 9, 3);
    holidays.push({ name: '敬老の日', date: new Date(year, 8, respectForTheAgedDay) });
  } else if (year >= 1966) {
    holidays.push({ name: '敬老の日', date: new Date(year, 8, 15) });
  }

  // 秋分の日
  const autumnalEquinox = calculateAutumnalEquinox(year);
  holidays.push({ name: '秋分の日', date: new Date(year, 8, autumnalEquinox) });

  // スポーツの日（体育の日）
  if (year === 2021) {
    // 2021年は五輪特例で7月23日
    holidays.push({ name: 'スポーツの日', date: new Date(year, 6, 23) });
  } else if (year >= 2020) {
    const sportsDay = getNthMonday(year, 10, 2);
    holidays.push({ name: 'スポーツの日', date: new Date(year, 9, sportsDay) });
  } else if (year >= 2000) {
    const healthAndSportsDay = getNthMonday(year, 10, 2);
    holidays.push({ name: '体育の日', date: new Date(year, 9, healthAndSportsDay) });
  } else if (year >= 1966) {
    holidays.push({ name: '体育の日', date: new Date(year, 9, 10) });
  }

  // 文化の日
  holidays.push({ name: '文化の日', date: new Date(year, 10, 3) });

  // 勤労感謝の日
  holidays.push({ name: '勤労感謝の日', date: new Date(year, 10, 23) });

  return holidays;
};

/**
 * 振替休日を計算
 */
const getSubstituteHolidays = (year: number, holidays: Holiday[]): Holiday[] => {
  const substitutes: Holiday[] = [];

  holidays.forEach(holiday => {
    const date = new Date(holiday.date);

    // 日曜日の祝日の場合、翌日以降の平日を振替休日とする
    if (date.getDay() === 0) {
      const substituteDate = new Date(date);
      substituteDate.setDate(substituteDate.getDate() + 1);

      // 翌日以降で祝日でない平日を探す
      while (holidays.some(h => h.date.getTime() === substituteDate.getTime()) ||
             substitutes.some(s => s.date.getTime() === substituteDate.getTime())) {
        substituteDate.setDate(substituteDate.getDate() + 1);
      }

      substitutes.push({ name: '振替休日', date: substituteDate });
    }
  });

  return substitutes;
};

/**
 * 指定年の全祝日（振替休日含む）を取得
 */
export const getAllHolidays = (year: number): Holiday[] => {
  const holidays = getHolidays(year);
  const substitutes = getSubstituteHolidays(year, holidays);
  return [...holidays, ...substitutes].sort((a, b) => a.date.getTime() - b.date.getTime());
};

/**
 * 内閣府データを優先した祝日取得（Firestore経由）
 */
export const getHolidaysWithCabinetOfficeData = async (year: number): Promise<Holiday[]> => {
  try {
    const { globalHolidayService } = await import('@/services/globalHolidayService');
    return await globalHolidayService.getHolidaysForYear(year);
  } catch (error) {
    console.warn('Failed to get holidays from Firestore, using calculated holidays:', error);
    return getAllHolidays(year);
  }
};

/**
 * 内閣府データを優先した祝日判定（Firestore経由）
 */
export const isHolidayWithCabinetOfficeData = async (date: Date): Promise<Holiday | null> => {
  try {
    const { globalHolidayService } = await import('@/services/globalHolidayService');
    return await globalHolidayService.isHoliday(date);
  } catch (error) {
    console.warn('Failed to check holiday from Firestore, using calculated holidays:', error);
    return isHoliday(date);
  }
};

/**
 * 指定日が祝日かどうかを判定（計算ベース）
 */
export const isHoliday = (date: Date): Holiday | null => {
  const year = date.getFullYear();
  const holidays = getAllHolidays(year);

  return holidays.find(holiday =>
    holiday.date.getFullYear() === date.getFullYear() &&
    holiday.date.getMonth() === date.getMonth() &&
    holiday.date.getDate() === date.getDate()
  ) || null;
};

/**
 * 指定期間内の祝日を取得（計算ベース）
 */
export const getHolidaysForPeriod = (startDate: Date, endDate: Date): Holiday[] => {
  const holidays: Holiday[] = [];
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();

  // 開始年から終了年まで、各年の祝日を取得
  for (let year = startYear; year <= endYear; year++) {
    const yearHolidays = getAllHolidays(year);

    // 期間内の祝日のみフィルタ
    const filtered = yearHolidays.filter(holiday => {
      const holidayTime = holiday.date.getTime();
      return holidayTime >= startDate.getTime() && holidayTime < endDate.getTime();
    });

    holidays.push(...filtered);
  }

  return holidays;
};
