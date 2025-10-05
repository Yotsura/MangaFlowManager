import type { Holiday } from '@/utils/dateUtils';
import { getDocument, setDocument } from '@/services/firebase/firestoreService';

/**
 * Firestoreでグローバル祝日データを管理するサービス
 */
export class GlobalHolidayService {
  private static instance: GlobalHolidayService;
  private holidays: Holiday[] = [];
  private lastUpdated: Date | null = null;
  private readonly GLOBAL_COLLECTION = 'globalSettings';
  private readonly HOLIDAY_DOCUMENT = 'holidays';
  private readonly CABINET_OFFICE_URL = 'https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv';

  private constructor() {}

  public static getInstance(): GlobalHolidayService {
    if (!GlobalHolidayService.instance) {
      GlobalHolidayService.instance = new GlobalHolidayService();
    }
    return GlobalHolidayService.instance;
  }

  /**
   * Firestoreパス
   */
  private getDocumentPath(): string {
    return `${this.GLOBAL_COLLECTION}/${this.HOLIDAY_DOCUMENT}`;
  }

  /**
   * 祝日データが更新が必要かチェック
   */
  private needsUpdate(lastUpdated: Date | null): boolean {
    if (!lastUpdated) {
      return true;
    }

    // 月初めかつ前回更新から1ヶ月以上経過している場合
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const lastUpdateMonth = lastUpdated.getMonth();
    const lastUpdateYear = lastUpdated.getFullYear();

    return (currentYear > lastUpdateYear) ||
           (currentYear === lastUpdateYear && currentMonth > lastUpdateMonth);
  }

  /**
   * Firestoreから祝日データを読み込み
   */
  private async loadFromFirestore(): Promise<{holidays: Holiday[], lastUpdated: Date | null}> {
    try {
      const document = await getDocument<{
        holidays: Array<{name: string, date: string}>,
        lastUpdated: string
      }>(this.getDocumentPath());

      if (document?.holidays) {
        const holidays = document.holidays.map(item => ({
          name: item.name,
          date: new Date(item.date)
        }));

        const lastUpdated = document.lastUpdated ? new Date(document.lastUpdated) : null;

        return { holidays, lastUpdated };
      }
    } catch (error) {
      console.warn('Failed to load holidays from Firestore:', error);
    }

    return { holidays: [], lastUpdated: null };
  }

  /**
   * Firestoreに祝日データを保存
   */
  private async saveToFirestore(holidays: Holiday[]): Promise<void> {
    try {
      const data = {
        holidays: holidays.map(holiday => ({
          name: holiday.name,
          date: holiday.date.toISOString()
        })),
        lastUpdated: new Date().toISOString(),
        version: 1,
        source: 'cabinet_office'
      };

      await setDocument(this.getDocumentPath(), data);
      console.log(`Saved ${holidays.length} holidays to Firestore`);
    } catch (error) {
      console.error('Failed to save holidays to Firestore:', error);
      throw error;
    }
  }

  /**
   * CSVデータをパース
   */
  private parseCSV(csvText: string): Holiday[] {
    const lines = csvText.split(/\r?\n/);
    const holidays: Holiday[] = [];

    // ヘッダー行を探す
    let startIndex = 0;
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i]?.trim();
      if (line && (line.includes('国民の祝日・休日月日') || line.includes('国民の祝日'))) {
        startIndex = i + 1;
        break;
      }
    }

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (!line) continue;

      const columns = this.parseCSVLine(line);
      if (columns.length >= 2) {
        const dateStr = columns[0]?.trim();
        const name = columns[1]?.trim();

        if (!dateStr || !name) continue;

        const cleanedName = this.cleanHolidayName(name);
        if (!cleanedName) continue;

        try {
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
   * CSV行をパース
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
   * 祝日名をクリーンアップ
   */
  private cleanHolidayName(name: string): string {
    if (!name) return '';

    let cleaned = name.replace(/[""]/g, '').trim();
    cleaned = cleaned.replace(/[\x00-\x1F\x7F-\x9F]/g, '');

    // 文字化け文字を直接置き換え（正規表現を使わない）
    cleaned = cleaned.replace(/\?/g, '');  // ?を除去
    cleaned = cleaned.replace(/�/g, '');   // 置換文字を除去
    cleaned = cleaned.replace(/\uFFFD/g, ''); // Unicode置換文字を除去

    if (!cleaned || cleaned.length < 2) {
      return '';
    }

    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(cleaned);
    if (!hasJapanese) {
      return '';
    }

    return cleaned;
  }

  /**
   * 内閣府から祝日データを取得
   */
  private async fetchFromCabinetOffice(): Promise<Holiday[]> {
    const proxyServices = [
      `https://api.allorigins.win/get?url=${encodeURIComponent(this.CABINET_OFFICE_URL)}&charset=shift_jis`,
      `https://api.allorigins.win/get?url=${encodeURIComponent(this.CABINET_OFFICE_URL)}`,
      `https://corsproxy.io/?${encodeURIComponent(this.CABINET_OFFICE_URL)}`
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

        if (proxyUrl.includes('allorigins.win')) {
          const data = await response.json() as { contents: string };
          csvText = data.contents;
        } else {
          const arrayBuffer = await response.arrayBuffer();
          csvText = this.decodeShiftJIS(arrayBuffer);
        }

        const holidays = this.parseCSV(csvText);
        if (holidays.length > 0) {
          console.log(`Successfully fetched ${holidays.length} holidays from Cabinet Office via ${proxyUrl}`);
          return holidays;
        }
      } catch (error) {
        lastError = error as Error;
        console.warn(`Failed to fetch via ${proxyUrl}:`, error);
        continue;
      }
    }

    throw lastError || new Error('All proxy services failed');
  }

  /**
   * Shift-JISデコード
   */
  private decodeShiftJIS(arrayBuffer: ArrayBuffer): string {
    try {
      const decoder = new TextDecoder('shift-jis');
      return decoder.decode(arrayBuffer);
    } catch (error) {
      console.warn('Failed to decode as Shift-JIS, trying UTF-8:', error);
      try {
        const decoder = new TextDecoder('utf-8');
        return decoder.decode(arrayBuffer);
      } catch (utf8Error) {
        console.warn('Failed to decode as UTF-8, using binary fallback:', utf8Error);
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
   * 祝日データを取得（Firestore優先、必要に応じて更新）
   */
  public async getHolidays(): Promise<Holiday[]> {
    try {
      // Firestoreから最新データを取得
      const { holidays: firestoreHolidays, lastUpdated } = await this.loadFromFirestore();

      // データが存在し、更新が不要な場合はそのまま返す
      if (firestoreHolidays.length > 0 && !this.needsUpdate(lastUpdated)) {
        this.holidays = firestoreHolidays;
        this.lastUpdated = lastUpdated;
        return this.holidays;
      }

      // 更新が必要な場合は内閣府から取得
      console.log('Updating holidays from Cabinet Office...');
      const freshHolidays = await this.fetchFromCabinetOffice();

      if (freshHolidays.length > 0) {
        // Firestoreに保存
        await this.saveToFirestore(freshHolidays);
        this.holidays = freshHolidays;
        this.lastUpdated = new Date();
        return this.holidays;
      } else {
        // 新しいデータが取得できない場合は既存データを使用
        return firestoreHolidays;
      }
    } catch (error) {
      console.error('Failed to get holidays:', error);

      // エラー時は既存のFirestoreデータを使用
      const { holidays: fallbackHolidays } = await this.loadFromFirestore();
      return fallbackHolidays;
    }
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
   * 強制的に祝日データを再取得（管理者用）
   */
  public async forceUpdate(): Promise<Holiday[]> {
    try {
      console.log('Force updating holidays from Cabinet Office...');
      const freshHolidays = await this.fetchFromCabinetOffice();

      if (freshHolidays.length > 0) {
        await this.saveToFirestore(freshHolidays);
        this.holidays = freshHolidays;
        this.lastUpdated = new Date();
        console.log(`Force updated ${freshHolidays.length} holidays`);
        return this.holidays;
      }

      throw new Error('No holidays fetched');
    } catch (error) {
      console.error('Failed to force update holidays:', error);
      throw error;
    }
  }
}

export const globalHolidayService = GlobalHolidayService.getInstance();

// デバッグ用
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).globalHolidayService = globalHolidayService;
  console.log('Global holiday service available as window.globalHolidayService for debugging');
}
