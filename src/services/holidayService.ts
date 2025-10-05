import { Holiday } from '@/utils/dateUtils';

/**
 * 内閣府祝日データの管理サービス
 */
export class HolidayService {
  private static instance: HolidayService;
  private holidays: Holiday[] = [];
  private lastUpdated: Date | null = null;
  private readonly CACHE_KEY = 'cabinet_office_holidays';
  private readonly LAST_UPDATED_KEY = 'holidays_last_updated';
  private readonly CABINET_OFFICE_URL = 'https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv';

  private constructor() {}

  public static getInstance(): HolidayService {
    if (!HolidayService.instance) {
      HolidayService.instance = new HolidayService();
    }
    return HolidayService.instance;
  }

  /**
   * 祝日データが更新が必要かチェック
   */
  private needsUpdate(): boolean {
    if (!this.lastUpdated) {
      const storedDate = localStorage.getItem(this.LAST_UPDATED_KEY);
      if (storedDate) {
        this.lastUpdated = new Date(storedDate);
      }
    }

    if (!this.lastUpdated) {
      return true;
    }

    // 月初めかつ前回更新から1ヶ月以上経過している場合
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const lastUpdateMonth = this.lastUpdated.getMonth();
    const lastUpdateYear = this.lastUpdated.getFullYear();

    return (currentYear > lastUpdateYear) || 
           (currentYear === lastUpdateYear && currentMonth > lastUpdateMonth);
  }

  /**
   * ローカルストレージから祝日データを読み込み
   */
  private loadFromLocalStorage(): Holiday[] {
    try {
      const stored = localStorage.getItem(this.CACHE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        return data.map((item: any) => ({
          name: item.name,
          date: new Date(item.date)
        }));
      }
    } catch (error) {
      console.warn('Failed to load holidays from localStorage:', error);
    }
    return [];
  }

  /**
   * ローカルストレージに祝日データを保存
   */
  private saveToLocalStorage(holidays: Holiday[]): void {
    try {
      const data = holidays.map(holiday => ({
        name: holiday.name,
        date: holiday.date.toISOString()
      }));
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(data));
      
      const now = new Date();
      localStorage.setItem(this.LAST_UPDATED_KEY, now.toISOString());
      this.lastUpdated = now;
    } catch (error) {
      console.warn('Failed to save holidays to localStorage:', error);
    }
  }

  /**
   * CSVデータをパース
   */
  private parseCSV(csvText: string): Holiday[] {
    const lines = csvText.split('\n');
    const holidays: Holiday[] = [];

    for (let i = 1; i < lines.length; i++) { // ヘッダー行をスキップ
      const line = lines[i].trim();
      if (!line) continue;

      const columns = line.split(',');
      if (columns.length >= 2) {
        const dateStr = columns[0].trim();
        const name = columns[1].trim().replace(/"/g, ''); // ダブルクォートを除去

        try {
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            holidays.push({ name, date });
          }
        } catch (error) {
          console.warn(`Failed to parse date: ${dateStr}`, error);
        }
      }
    }

    return holidays;
  }

  /**
   * 内閣府から祝日データを取得
   */
  private async fetchFromCabinetOffice(): Promise<Holiday[]> {
    try {
      // CORSの問題を回避するため、プロキシサーバーを使用
      // 本番環境では適切なプロキシ設定が必要
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(this.CABINET_OFFICE_URL)}`;
      
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const csvText = data.contents;
      
      return this.parseCSV(csvText);
    } catch (error) {
      console.warn('Failed to fetch holidays from Cabinet Office:', error);
      throw error;
    }
  }

  /**
   * 祝日データを取得（キャッシュ優先、必要に応じて更新）
   */
  public async getHolidays(): Promise<Holiday[]> {
    // キャッシュされたデータを読み込み
    if (this.holidays.length === 0) {
      this.holidays = this.loadFromLocalStorage();
    }

    // 更新が必要な場合のみ内閣府から取得
    if (this.needsUpdate()) {
      try {
        console.log('Updating holidays from Cabinet Office...');
        const freshHolidays = await this.fetchFromCabinetOffice();
        
        if (freshHolidays.length > 0) {
          this.holidays = freshHolidays;
          this.saveToLocalStorage(this.holidays);
          console.log(`Updated ${this.holidays.length} holidays from Cabinet Office`);
        }
      } catch (error) {
        console.warn('Failed to update holidays, using cached data:', error);
        // フェッチに失敗した場合はキャッシュデータを使用
      }
    }

    return this.holidays;
  }

  /**
   * 指定した日付が祝日かどうかをチェック
   */
  public async isHoliday(date: Date): Promise<Holiday | null> {
    const holidays = await this.getHolidays();
    
    return holidays.find(holiday => 
      holiday.date.getFullYear() === date.getFullYear() &&
      holiday.date.getMonth() === date.getMonth() &&
      holiday.date.getDate() === date.getDate()
    ) || null;
  }

  /**
   * 指定した年の祝日を取得
   */
  public async getHolidaysForYear(year: number): Promise<Holiday[]> {
    const holidays = await this.getHolidays();
    return holidays.filter(holiday => holiday.date.getFullYear() === year);
  }

  /**
   * キャッシュをクリア（デバッグ用）
   */
  public clearCache(): void {
    localStorage.removeItem(this.CACHE_KEY);
    localStorage.removeItem(this.LAST_UPDATED_KEY);
    this.holidays = [];
    this.lastUpdated = null;
  }
}

export const holidayService = HolidayService.getInstance();