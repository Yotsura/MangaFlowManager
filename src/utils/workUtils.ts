import type { WorkUnit } from "@/store/worksStore";

/**
 * 最下位ユニット（リーフノード）を全て取得する関数
 * stageIndexを持つユニット（最下位の作業単位）を再帰的に収集します
 */
export const collectLeafUnits = (units: WorkUnit[]): WorkUnit[] => {
  const leafUnits: WorkUnit[] = [];

  const collectLeaves = (units: WorkUnit[]) => {
    for (const unit of units) {
      if (unit.stageIndex !== undefined) {
        // stageIndexを持つユニットは最下位
        leafUnits.push(unit);
      } else if (unit.children && unit.children.length > 0) {
        // 子がいる場合は再帰的に探索
        collectLeaves(unit.children);
      }
    }
  };

  collectLeaves(units);
  return leafUnits;
};
