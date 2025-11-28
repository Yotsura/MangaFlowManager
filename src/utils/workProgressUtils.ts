import { normalizeStageColorValue } from "@/modules/works/utils/stageColor";
import type { UnitStageCountEntry, WorkProgressHistory } from "@/types/models";
import type { WorkStageWorkload } from "@/types/work";
import type { StageWorkloadMetrics } from "@/utils/workStoreHelpers";

export type StageDisplaySource = Array<Pick<WorkStageWorkload, "id" | "label" | "color">>;

const normalizeCount = (value: unknown): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }
  return Math.floor(numeric);
};

const normalizeStageId = (value: unknown, fallback: number | null = null): number | null => {
  if (value === null) {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.floor(numeric);
};

export const cloneStageCounts = (counts: UnitStageCountEntry[]): UnitStageCountEntry[] =>
  counts.map(entry => ({
    stageId: normalizeStageId(entry?.stageId),
    count: normalizeCount(entry?.count),
  }));

export const resolveStageIdOrder = (stageWorkloads: StageDisplaySource): number[] =>
  stageWorkloads.map((stage, index) => {
    const numeric = Number(stage.id);
    if (!Number.isFinite(numeric)) {
      return index + 1;
    }
    return Math.floor(numeric);
  });

export const resolveStageLabels = (stageWorkloads: StageDisplaySource): string[] =>
  stageWorkloads.map(stage => stage.label);

export const resolveStageColors = (
  stageWorkloads: StageDisplaySource,
  fallbackColor = "#0d6efd"
): string[] => {
  const totalStages = stageWorkloads.length;
  return stageWorkloads.map((stage, index) =>
    normalizeStageColorValue(stage.color, index, totalStages) || fallbackColor
  );
};

export const hexToRgba = (hex: string, alpha: number): string => {
  const sanitized = hex.trim().replace(/^#/, "");
  const normalized = sanitized.length === 3
    ? sanitized.split("").map(char => char + char).join("")
    : sanitized;

  const value = parseInt(normalized, 16);
  if (!Number.isFinite(value)) {
    return `rgba(13, 110, 253, ${alpha})`;
  }

  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const normalizeUnitStageCounts = (
  rawCounts: WorkProgressHistory["unitStageCounts"],
  metrics: StageWorkloadMetrics | null
): UnitStageCountEntry[] => {
  if (!metrics) {
    return [];
  }

  const stageIds = resolveStageIdOrder(metrics.stageWorkloads);
  const accumulator = new Map<number | null, number>();

  const addCount = (stageId: number | null, value: unknown) => {
    const parsed = normalizeCount(value);
    if (parsed <= 0) {
      return;
    }
    const current = accumulator.get(stageId) ?? 0;
    accumulator.set(stageId, current + parsed);
  };

  if (Array.isArray(rawCounts)) {
    (rawCounts as UnitStageCountEntry[]).forEach(entry => {
      if (!entry || typeof entry !== "object") {
        return;
      }
      const stageId = normalizeStageId(entry.stageId, null);
      addCount(stageId, entry.count);
    });
  }

  const normalized = stageIds.map(stageId => ({
    stageId,
    count: accumulator.get(stageId) ?? 0,
  }));

  const completedCount = accumulator.get(null);
  if (completedCount && completedCount > 0) {
    normalized.push({ stageId: null, count: completedCount });
  }

  return normalized;
};
