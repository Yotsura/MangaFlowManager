import type { UnitStageCounts } from "@/types/models";
import type { Work, WorkGranularity, WorkStageWorkload, WorkUnit } from "@/types/work";
import { collectLeafUnits } from "@/utils/workUtils";

/**
 * エラーメッセージをマッピング
 */
export const mapError = (error: unknown, fallback: string): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
};

/**
 * Firestore コレクションパスを構築
 */
export const buildWorkCollectionPath = (userId: string): string => `users/${userId}/works`;

/**
 * Firestore ドキュメントパスを構築
 */
export const buildWorkDocumentPath = (userId: string, workId: string): string =>
  `${buildWorkCollectionPath(userId)}/${workId}`;

/**
 * 正の整数に正規化
 */
export const normalizePositiveInteger = (value: number, fallback: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
};

/**
 * ユニットのインデックスを再計算（再帰的）
 */
export const recalculateUnitIndices = (units: WorkUnit[]): void => {
  units.forEach((unit, index) => {
    unit.index = index + 1;
    if (unit.children) {
      recalculateUnitIndices(unit.children);
    }
  });
};

/**
 * 階層内のユニットを検索
 */
export const findUnitInHierarchy = (units: WorkUnit[], unitId: string): WorkUnit | null => {
  for (const unit of units) {
    if (unit.id === unitId) {
      return unit;
    }
    if (unit.children) {
      const found = findUnitInHierarchy(unit.children, unitId);
      if (found) {
        return found;
      }
    }
  }
  return null;
};

/**
 * 最下位ユニット（リーフノード）を全て取得
 */
export const getAllLeafUnits = collectLeafUnits;

/**
 * 作品の実際の階層深度を検出
 */
export const getActualWorkDepth = (units: WorkUnit[]): number => {
  if (units.length === 0) return 0;
  let maxDepth = 0;
  const traverse = (units: WorkUnit[], currentDepth: number) => {
    for (const unit of units) {
      if (unit.stageIndex !== undefined) {
        // 最下位ユニット（葉ノード）に到達
        maxDepth = Math.max(maxDepth, currentDepth);
      } else if (unit.children) {
        traverse(unit.children, currentDepth + 1);
      }
    }
  };
  traverse(units, 1);
  return maxDepth;
};

/**
 * ユニットの階層深度を計算
 */
export const getUnitDepthInHierarchy = (
  targetUnit: WorkUnit,
  rootUnits: WorkUnit[],
  currentDepth: number = 0
): number => {
  // ルートレベルで見つかった場合
  if (rootUnits.includes(targetUnit)) {
    return currentDepth;
  }

  // 子レベルを再帰的に検索
  for (const unit of rootUnits) {
    if (unit.children) {
      const foundDepth = getUnitDepthInHierarchy(targetUnit, unit.children, currentDepth + 1);
      if (foundDepth !== -1) {
        return foundDepth;
      }
    }
  }
  return -1; // 見つからない場合
};

export interface StageWorkloadMetrics {
  stageWorkloads: WorkStageWorkload[];
  granularities: WorkGranularity[];
  stageWorkloadHours: number[];
  cumulativeWorkloads: number[];
  totalWorkHoursPerUnit: number;
}

export const buildStageWorkloadMetrics = (
  work: Work,
  defaultGranularities: WorkGranularity[],
  defaultStageWorkloads: WorkStageWorkload[]
): StageWorkloadMetrics | null => {
  const granularities = (work.workGranularities && work.workGranularities.length > 0)
    ? work.workGranularities
    : defaultGranularities;

  const stageWorkloads = (work.workStageWorkloads && work.workStageWorkloads.length > 0)
    ? work.workStageWorkloads
    : defaultStageWorkloads;

  if (!work.primaryGranularityId || granularities.length === 0 || stageWorkloads.length === 0) {
    return null;
  }

  const lowestGranularity = granularities.reduce((min, current) =>
    current.weight < min.weight ? current : min
  );

  const stageWorkloadHours = stageWorkloads.map(stage => {
    let baseHours = stage.baseHours;

    if (baseHours === null || baseHours === undefined) {
      if (stage.entries && Array.isArray(stage.entries)) {
        const lowestEntry = stage.entries.find(entry =>
          entry.granularityId === lowestGranularity.id && entry.hours !== null && entry.hours !== undefined
        );

        if (lowestEntry) {
          baseHours = lowestEntry.hours ?? null;
        } else {
          for (const entry of stage.entries) {
            if (entry.hours !== null && entry.hours !== undefined) {
              const entryGranularity = granularities.find(g => g.id === entry.granularityId);
              if (entryGranularity) {
                baseHours = (entry.hours * lowestGranularity.weight) / entryGranularity.weight;
                break;
              }
            }
          }
        }
      }
    }

    if (baseHours === null || baseHours === undefined) {
      return 0;
    }

    return baseHours;
  });

  const cumulativeWorkloads = stageWorkloadHours.reduce((acc, hours, index) => {
    const prevTotal = index > 0 ? (acc[index - 1] ?? 0) : 0;
    acc.push(prevTotal + hours);
    return acc;
  }, [] as number[]);

  const totalWorkHoursPerUnit = cumulativeWorkloads[cumulativeWorkloads.length - 1] || 0;

  return {
    stageWorkloads,
    granularities,
    stageWorkloadHours,
    cumulativeWorkloads,
    totalWorkHoursPerUnit
  };
};

export const calculateCompletedHoursFromStageCounts = (
  unitStageCounts: UnitStageCounts | undefined,
  metrics: StageWorkloadMetrics | null
): number => {
  if (!unitStageCounts || !metrics) {
    return 0;
  }

  const stageCount = metrics.stageWorkloadHours.length;
  const totalPerUnit = metrics.totalWorkHoursPerUnit;

  if (stageCount === 0) {
    return 0;
  }

  const resolveHoursForSlot = (slotIndex: number): number => {
    if (slotIndex >= stageCount) {
      return totalPerUnit;
    }
    return metrics.cumulativeWorkloads[slotIndex] ?? 0;
  };

  let total = 0;

  const stageIndexById = new Map<number, number>();
  metrics.stageWorkloads.forEach((stage, index) => {
    const numeric = Number(stage.id);
    const stageId = Number.isFinite(numeric) ? numeric : index + 1;
    stageIndexById.set(stageId, index);
  });

  unitStageCounts.forEach(entry => {
    if (!entry) {
      return;
    }

    const count = Number(entry.count);
    if (!Number.isFinite(count) || count <= 0) {
      return;
    }

    let stageId: number | null = null;
    if (entry.stageId === null) {
      stageId = null;
    } else if (typeof entry.stageId === "number") {
      stageId = entry.stageId;
    } else if (typeof entry.stageId === "string") {
      const parsedId = Number(entry.stageId);
      stageId = Number.isFinite(parsedId) ? parsedId : null;
    }

    if (stageId === null) {
      total += count * totalPerUnit;
      return;
    }

    const slotIndex = stageIndexById.get(stageId);

    if (slotIndex === undefined) {
      total += count * totalPerUnit;
      return;
    }

    if (slotIndex === 0) {
      return;
    }

    total += count * resolveHoursForSlot(slotIndex);
  });

  return Number(total.toFixed(2));
};
