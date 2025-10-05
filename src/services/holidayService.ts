import type { Holiday } from '@/utils/dateUtils';

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
        const data = JSON.parse(stored) as Array<{name: string, date: string}>;
        return data.map((item) => ({
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
    const lines = csvText.split(/\r?\n/); // Windows/Unix 両方の改行に対応
    const holidays: Holiday[] = [];

    // ヘッダー行を探す（データが途中から始まる場合に対応）
    let startIndex = 0;
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i]?.trim();
      if (line && line.includes('国民の祝日・休日月日') || line && line.includes('国民の祝日')) {
        startIndex = i + 1;
        break;
      }
    }

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (!line) continue;

      // CSV の各フィールドをパース（カンマ区切り、ダブルクォート対応）
      const columns = this.parseCSVLine(line);
      if (columns.length >= 2) {
        const dateStr = columns[0]?.trim();
        const name = columns[1]?.trim();

        if (!dateStr || !name) continue;

        // 文字化けや不正な文字をクリーンアップ
        const cleanedName = this.cleanHolidayName(name);

        if (!cleanedName) continue;

        try {
          // 日付フォーマット: YYYY/MM/DD または YYYY-MM-DD
          const normalizedDateStr = dateStr.replace(/\//g, '-');
          const date = new Date(normalizedDateStr);

          if (!isNaN(date.getTime()) && date.getFullYear() > 1900) {
            holidays.push({ name: cleanedName, date });
          }
        } catch (error) {
          console.warn(`Failed to parse date: ${dateStr}`, error);
        }
      }
    }

    return holidays;
  }

  /**
   * CSV行をパース（ダブルクォート、カンマ対応）
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  /**
   * 祝日名をクリーンアップ（文字化け対応）
   */
  private cleanHolidayName(name: string): string {
    if (!name) return '';

    // ダブルクォートと余分な空白を除去
    let cleaned = name.replace(/[""]/g, '').trim();

    // 文字化けした文字を除去（制御文字や非表示文字）
    cleaned = cleaned.replace(/[\x00-\x1F\x7F-\x9F]/g, '');

    // 文字化けパターンを日本語に置換（よくある文字化けパターン）
    const charMapping: Record<string, string> = {
      '?': '',  // 文字化けした？を除去
      '�': '',  // 置換文字を除去
      // 他の文字化けパターンがあれば追加
    };

    for (const [garbled, replacement] of Object.entries(charMapping)) {
      cleaned = cleaned.replace(new RegExp(garbled, 'g'), replacement);
    }

    // 空文字列や意味のない文字列をフィルタ
    if (!cleaned || cleaned.length < 2) {
      return '';
    }

    // 日本語文字が含まれているかチェック
    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(cleaned);
    if (!hasJapanese) {
      return '';
    }

    return cleaned;
  }

  /**
   * Shift-JIS (CP932) バイナリデータをUTF-8文字列にデコード
   */
  private decodeShiftJIS(arrayBuffer: ArrayBuffer): string {
    try {
      // TextDecoder を使用してShift-JIS (CP932) をデコード
      const decoder = new TextDecoder('shift-jis');
      return decoder.decode(arrayBuffer);
    } catch (error) {
      console.warn('Failed to decode as Shift-JIS, trying UTF-8:', error);
      // フォールバック: UTF-8として試行
      try {
        const decoder = new TextDecoder('utf-8');
        return decoder.decode(arrayBuffer);
      } catch (utf8Error) {
        console.warn('Failed to decode as UTF-8, using binary fallback:', utf8Error);
        // 最終フォールバック: バイナリデータを直接文字列に変換
        const uint8Array = new Uint8Array(arrayBuffer);
        let result = '';
        for (let i = 0; i < uint8Array.length; i++) {
          const byte = uint8Array[i];
          if (byte !== undefined) {
            result += String.fromCharCode(byte);
          }
        }
        return result;
      }
    }
  }

  /**
   * 内閣府から祝日データを取得
   */
  private async fetchFromCabinetOffice(): Promise<Holiday[]> {
    try {
      // CORSの問題を回避するため、複数のプロキシサービスを試行
      const proxyServices = [
        // charset=shift_jis を指定してalloriginsに文字エンコーディングを伝える
        `https://api.allorigins.win/get?url=${encodeURIComponent(this.CABINET_OFFICE_URL)}&charset=shift_jis`,
        `https://api.allorigins.win/get?url=${encodeURIComponent(this.CABINET_OFFICE_URL)}`,
        `https://corsproxy.io/?${encodeURIComponent(this.CABINET_OFFICE_URL)}`,
        `https://cors-anywhere.herokuapp.com/${this.CABINET_OFFICE_URL}`
      ];

      let lastError: Error | null = null;

      for (const proxyUrl of proxyServices) {
        try {
          const response = await fetch(proxyUrl, {
            headers: {
              'Origin': window.location.origin
            }
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          let csvText: string;

          // allorigins の場合は JSON レスポンス
          if (proxyUrl.includes('allorigins.win')) {
            const data = await response.json() as { contents: string };
            csvText = data.contents;
          } else {
            // バイナリデータとして取得してShift-JISからUTF-8に変換
            const arrayBuffer = await response.arrayBuffer();
            csvText = this.decodeShiftJIS(arrayBuffer);
          }

          const holidays = this.parseCSV(csvText);
          if (holidays.length > 0) {
            console.log(`Successfully fetched ${holidays.length} holidays from Cabinet Office via ${proxyUrl}`);
            console.log('Sample holidays:', holidays.slice(0, 3)); // 最初の3件をログ出力
            return holidays;
          } else {
            console.warn('No holidays parsed from CSV. Sample CSV content:', csvText.substring(0, 500));
          }
        } catch (error) {
          lastError = error as Error;
          console.warn(`Failed to fetch via ${proxyUrl}:`, error);
          continue;
        }
      }

      throw lastError || new Error('All proxy services failed');
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
    console.log('Holiday cache cleared');
  }

  /**
   * 強制的に祝日データを再取得（デバッグ用）
   */
  public async forceUpdate(): Promise<Holiday[]> {
    this.clearCache();
    return await this.getHolidays();
  }
}

export const holidayService = HolidayService.getInstance();

// 開発環境でデバッグ用にグローバルに公開
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).holidayService = holidayService;
  console.log('Holiday service available as window.holidayService for debugging');
}
