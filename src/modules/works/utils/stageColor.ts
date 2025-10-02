const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

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

const contrastTextFromHsl = (hue: number, saturation: number, lightness: number) => {
  const [r, g, b] = hslToRgb(hue / 360, saturation / 100, lightness / 100);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.6 ? "#212529" : "#ffffff";
};

export const stageColorFor = (stageIndex: number, stageCount: number) => {
  if (stageCount <= 0 || stageIndex < 0) {
    return {
      backgroundColor: "#dee2e6",
      textColor: "#495057",
    };
  }

  const maxIndex = Math.max(stageCount - 1, 1);
  const boundedIndex = clamp(stageIndex, 0, maxIndex);
  const ratio = maxIndex === 0 ? 1 : boundedIndex / maxIndex;

  const hue = 0 + (120 - 0) * ratio;
  const saturation = 70;
  const lightness = 52;

  return {
    backgroundColor: `hsl(${Math.round(hue)}deg, ${saturation}%, ${lightness}%)`,
    textColor: contrastTextFromHsl(hue, saturation, lightness),
  };
};

export const stageBorderColorFor = (stageIndex: number, stageCount: number) => {
  const { backgroundColor } = stageColorFor(stageIndex, stageCount);
  return backgroundColor;
};
