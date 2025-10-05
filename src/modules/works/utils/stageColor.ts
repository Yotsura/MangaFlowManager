const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const HEX_COLOR_REGEX = /^#?([0-9a-fA-F]{6})$/;

const toHex = (value: number) => value.toString(16).padStart(2, "0");

const rgbToHex = (r: number, g: number, b: number) => `#${toHex(r)}${toHex(g)}${toHex(b)}`;

const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
  if (s === 0) {
    return [l, l, l];
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    let adjustedT = t;
    if (adjustedT < 0) adjustedT += 1;
    if (adjustedT > 1) adjustedT -= 1;
    if (adjustedT < 1 / 6) return p + (q - p) * 6 * adjustedT;
    if (adjustedT < 1 / 2) return q;
    if (adjustedT < 2 / 3) return p + (q - p) * (2 / 3 - adjustedT) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  const r = hue2rgb(p, q, h + 1 / 3);
  const g = hue2rgb(p, q, h);
  const b = hue2rgb(p, q, h - 1 / 3);

  return [r, g, b];
};

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const match = HEX_COLOR_REGEX.exec(hex);
  if (!match) {
    return { r: 222, g: 226, b: 230 };
  }

  const value = match[1];
  if (!value) {
    return { r: 222, g: 226, b: 230 };
  }

  const normalized = value.toLowerCase();
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);

  return { r, g, b };
};

const relativeLuminance = (r: number, g: number, b: number) => {
  const normalizeComponent = (component: number) => {
    const normalized = component / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
  };

  const rn = normalizeComponent(r);
  const gn = normalizeComponent(g);
  const bn = normalizeComponent(b);

  return 0.2126 * rn + 0.7152 * gn + 0.0722 * bn;
};

const sanitizeHex = (value: string | null | undefined) => {
  if (typeof value !== "string") {
    return null;
  }
  const match = HEX_COLOR_REGEX.exec(value.trim());
  if (!match) {
    return null;
  }
  const group = match[1];
  if (!group) {
    return null;
  }
  return `#${group.toLowerCase()}`;
};

const FALLBACK_NEUTRAL_COLOR = "#dee2e6";
const DARK_TEXT = "#212529";
const LIGHT_TEXT = "#ffffff";

export const getDefaultStageColor = (stageIndex: number, stageCount: number): string => {
  if (stageCount <= 0 || stageIndex < 0) {
    return FALLBACK_NEUTRAL_COLOR;
  }

  const maxIndex = Math.max(stageCount - 1, 1);
  const boundedIndex = clamp(stageIndex, 0, maxIndex);
  const ratio = maxIndex === 0 ? 1 : boundedIndex / maxIndex;

  // 指定されたRGB値で赤から緑へのグラデーション
  // 開始色: rgb(255, 77, 77) - 赤
  // 終了色: rgb(77, 255, 77) - 緑
  const startR = 255;
  const startG = 77;
  const startB = 77;

  const endR = 77;
  const endG = 255;
  const endB = 77;

  // 線形補間でグラデーション
  const r = Math.round(startR + (endR - startR) * ratio);
  const g = Math.round(startG + (endG - startG) * ratio);
  const b = Math.round(startB + (endB - startB) * ratio);

  return rgbToHex(r, g, b);
};

export const normalizeStageColorValue = (value: string | null | undefined, stageIndex: number, stageCount: number): string => {
  const sanitized = sanitizeHex(value);
  if (sanitized) {
    return sanitized;
  }
  return getDefaultStageColor(stageIndex, stageCount);
};

export const stageColorFor = (stageIndex: number, stageCount: number, overrideColor?: string) => {
  const backgroundColor = normalizeStageColorValue(overrideColor, stageIndex, stageCount);
  const { r, g, b } = hexToRgb(backgroundColor);
  const luminance = relativeLuminance(r, g, b);
  // 指定されたRGB色(255,77,77)～(77,255,77)は中程度の明度なので、標準的な閾値を使用
  const textColor = luminance > 0.4 ? DARK_TEXT : LIGHT_TEXT;

  return {
    backgroundColor,
    textColor,
  };
};

export const stageBorderColorFor = (stageIndex: number, stageCount: number, overrideColor?: string) => {
  const { backgroundColor } = stageColorFor(stageIndex, stageCount, overrideColor);
  return backgroundColor;
};
