import type { WorkUnit } from "@/types/work";
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
