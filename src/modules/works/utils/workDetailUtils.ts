/**
 * 背景色に対して適切なテキスト色を返す関数
 */
export const getContrastColor = (backgroundColor: string): string => {
  // カラーコードから RGB 値を抽出
  const hex = backgroundColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // 明度を計算 (0-255)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;

  // 明度が128より大きい場合は黒、そうでなければ白
  return brightness > 128 ? '#000000' : '#ffffff';
};

/**
 * 日付を日本語フォーマットで表示
 */
export const formatDate = (value: string): string => {
  if (!value) {
    return "";
  }
  try {
    return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return value;
  }
};

/**
 * 必要工数の危険度に応じたCSSクラスを返す
 */
export const getRequiredHoursClass = (requiredHours: number) => {
  return {
    'text-danger': requiredHours === Infinity || requiredHours > 12,
    'text-warning': requiredHours > 8 && requiredHours <= 12,
    'text-success': requiredHours <= 8
  };
};

/**
 * 必要工数の表示テキストを返す
 */
export const formatRequiredHours = (requiredHours: number): string => {
  return requiredHours === Infinity ? '不可能' : requiredHours.toFixed(1) + 'h';
};

/**
 * ユニットから最下層（リーフノード）を収集
 */
export const collectLeafUnits = <T extends { children?: T[] }>(units: T[]): T[] => {
  const result: T[] = [];
  for (const unit of units) {
    if (!unit.children || unit.children.length === 0) {
      result.push(unit);
    } else {
      result.push(...collectLeafUnits(unit.children));
    }
  }
  return result;
};

/**
 * 指定された工程までの進捗率を計算
 * @param units - 作品のユニット配列
 * @param stageIndex - 工程のインデックス
 * @returns 進捗率（0-100）
 */
export const calculateStageProgress = <T extends { children?: T[]; stageIndex?: number }>(
  units: T[],
  stageIndex: number
): number => {
  if (!units || units.length === 0) {
    return 0;
  }

  const allLeaves = collectLeafUnits(units);
  if (allLeaves.length === 0) {
    return 0;
  }

  // 指定された工程以上まで完了しているユニットの数
  const completedCount = allLeaves.filter(leaf => (leaf.stageIndex ?? 0) >= stageIndex).length;
  return Math.round((completedCount / allLeaves.length) * 100);
};
