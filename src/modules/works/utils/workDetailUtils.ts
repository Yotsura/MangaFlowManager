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
