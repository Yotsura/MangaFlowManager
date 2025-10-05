/**
 * 構造指定文字列のパース機能
 */

import type { WorkUnit } from '@/store/worksStore';

export interface ParsedStructure {
  topLevelUnits: TopLevelUnit[];
}

export interface TopLevelUnit {
  counts: number[];  // 各階層の数 [最上位, 第2階層, 第3階層, ...]
  stages: string[];  // 作業段階インデックスの文字列配列
  subUnits?: { count: number; stages: number[] }[]; // 詳細な構造情報（デバッグ用）
}

export interface StructureData {
  leafCount: number;
  stageIndices: number[];
}

export interface HierarchicalStructureData {
  children: {
    leafCount: number;
    stageIndices: number[];
  }[];
}

export interface WorkStructure {
  topLevelUnits: number;
  totalLeafUnits: number;
  leafUnitsPerTopUnit: number[];
  structureData: StructureData[];
  hierarchicalStructureData?: HierarchicalStructureData[];
  allStageIndices: number[];
}

/**
 * 最上位ユニット単位で括弧の深度をチェックする
 * @param structureStr 構造指定文字列
 * @returns 各最上位ユニットの最大括弧深度の配列
 */
const getTopLevelUnitDepths = (structureStr: string): number[] => {
  // まずカンマで分割（ただし括弧内のカンマは除外）
  const topLevelUnits: string[] = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i < structureStr.length; i++) {
    if (structureStr[i] === '[') {
      depth++;
    } else if (structureStr[i] === ']') {
      depth--;
    } else if (structureStr[i] === ',' && depth === 0) {
      const unit = structureStr.substring(start, i).trim();
      if (unit) topLevelUnits.push(unit);
      start = i + 1;
    }
  }

  // 最後の部分を追加
  const lastUnit = structureStr.substring(start).trim();
  if (lastUnit) topLevelUnits.push(lastUnit);

  // console.log('Debug: 分割された最上位ユニット:', topLevelUnits);

  // 各最上位ユニットの階層数を計算（括弧の深度 + 最下位レベル）
  return topLevelUnits.map(unit => {
    let maxBracketDepth = 0;
    let currentDepth = 0;

    for (let i = 0; i < unit.length; i++) {
      if (unit[i] === '[') {
        currentDepth++;
        maxBracketDepth = Math.max(maxBracketDepth, currentDepth);
      } else if (unit[i] === ']') {
        currentDepth--;
      }
    }

    // 階層数 = 括弧の深度 + 1（最下位の数値レベル）
    return maxBracketDepth + 1;
  });
};/**
 * ネストした括弧構造を再帰的に解析する
 * @param content 括弧内のコンテンツ
 * @returns パースされた構造またはnull
 */
const parseNestedStructure = (content: string): { stages: string[]; subUnits: { count: number; stages: number[] }[] } | null => {
  // 数値のみの場合（最下位レベル）
  if (/^[\d\/\s]+$/.test(content)) {
    const stageParts = content.split('/').map(s => s.trim()).filter(s => s);
    if (stageParts.length === 0) return null;

    // 各部分を数値として検証
    const stages: number[] = [];
    for (const part of stageParts) {
      const num = parseInt(part);
      if (isNaN(num) || num < 0) {
        return null;
      }
      stages.push(num);
    }

    return {
      stages: stageParts,
      subUnits: [{
        count: stages.length,
        stages: stages
      }]
    };
  }

  // ネストした括弧がある場合
  const subUnits: { count: number; stages: number[] }[] = [];
  const allStages: string[] = [];

  // 括弧をマッチングして分割
  let depth = 0;
  let start = 0;
  let i = 0;

  while (i < content.length) {
    if (content[i] === '[') {
      if (depth === 0) {
        start = i + 1;
      }
      depth++;
    } else if (content[i] === ']') {
      depth--;
      if (depth === 0) {
        // 一つの括弧セクションが完了
        const section = content.substring(start, i);
        const parsed = parseNestedStructure(section);
        if (!parsed) return null;

        // 最下位レベルの stages を収集
        allStages.push(...parsed.stages);
        subUnits.push(...parsed.subUnits);
      }
    }
    i++;
  }

  if (depth !== 0) {
    return null; // 括弧が対応していない
  }

  return {
    stages: allStages,
    subUnits: subUnits
  };
};

/**
 * 構造指定文字列をパースする
 * @param structureStr 構造指定文字列 (例: "[1],[5/5/5/5/5],[[1/2/3][4/5/6]]")
 * @param expectedDepth 期待される階層数（粒度設定から取得）
 * @returns パース結果またはnull
 */
export const parseStructureString = (structureStr: string, expectedDepth?: number): ParsedStructure | null => {
  try {
    if (!structureStr.trim()) {
      return null;
    }

    // 階層数チェック（期待される深度が指定されている場合）
    if (expectedDepth !== undefined) {
      const unitDepths = getTopLevelUnitDepths(structureStr);

      // すべての最上位ユニットが同じ階層数を持つかチェック
      const inconsistentDepths = unitDepths.filter(depth => depth !== expectedDepth);
      if (inconsistentDepths.length > 0) {
        console.error(`階層数が一致しません。期待: ${expectedDepth}層, 実際の階層数: [${unitDepths.join(', ')}]`);
        return null;
      }
    }

    // 最上位粒度：カンマで分割（ただし括弧内のカンマは除外）
    const topLevelUnits: string[] = [];
    let depth = 0;
    let start = 0;

    for (let i = 0; i < structureStr.length; i++) {
      if (structureStr[i] === '[') {
        depth++;
      } else if (structureStr[i] === ']') {
        depth--;
      } else if (structureStr[i] === ',' && depth === 0) {
        const unit = structureStr.substring(start, i).trim();
        if (unit) topLevelUnits.push(unit);
        start = i + 1;
      }
    }

    // 最後の部分を追加
    const lastUnit = structureStr.substring(start).trim();
    if (lastUnit) topLevelUnits.push(lastUnit);

    // console.log('Debug: parseStructureString 分割された最上位ユニット:', topLevelUnits);

    const units: TopLevelUnit[] = [];

    for (const unit of topLevelUnits) {
      // 最外側の括弧を除去
      const match = unit.match(/^\[(.+)\]$/);
      if (!match) {
        return null;
      }

      const content = match[1];
      const parsed = parseNestedStructure(content);
      if (!parsed) return null;

      // counts配列を構築（階層の深さに応じて）
      const totalLeafCount = parsed.stages.length;

      // 階層構造を推定
      let counts: number[];
      if (parsed.subUnits.length === 1) {
        // 2階層構造: [最上位=1, 最下位=stages数]
        counts = [1, totalLeafCount];
      } else {
        // 3階層以上: [最上位=1, 中間=subUnits数, 最下位=各subUnitのcount]
        counts = [1, parsed.subUnits.length];
      }

      units.push({
        counts,
        stages: parsed.stages,
        subUnits: parsed.subUnits
      });
    }

    return { topLevelUnits: units };
  } catch (error) {
    console.error('構造文字列の解析中にエラーが発生しました:', error);
    return null;
  }
};

/**
 * 構造指定文字列を検証する
 * @param structureStr 構造指定文字列
 * @param expectedDepth 期待される階層数（粒度設定から取得）
 * @returns エラーメッセージまたはnull（正常時）
 */
export const validateStructureString = (structureStr: string, expectedDepth?: number): string | null => {
  if (!structureStr.trim()) {
    return "構造指定文字列が空です。";
  }

  // 階層数チェック
  if (expectedDepth !== undefined) {
    const unitDepths = getTopLevelUnitDepths(structureStr);

    // すべての最上位ユニットが同じ階層数を持つかチェック
    const inconsistentDepths = unitDepths.filter(depth => depth !== expectedDepth);
    if (inconsistentDepths.length > 0) {
      const uniqueDepths = [...new Set(unitDepths)];
      if (uniqueDepths.length === 1) {
        return `階層数が粒度設定と一致しません。期待される階層数: ${expectedDepth}層, 入力された階層数: ${uniqueDepths[0]}層`;
      } else {
        return `階層数が粒度設定と一致しません。期待される階層数: ${expectedDepth}層, 入力された階層数: [${unitDepths.join(', ')}]層（不一致）`;
      }
    }
  }

  const parsed = parseStructureString(structureStr, expectedDepth);
  if (!parsed) {
    return "構造指定文字列の形式が正しくありません。[数値/数値/...]の形式で入力してください。";
  }

  // 各最上位単位の作業段階を検証
  for (let i = 0; i < parsed.topLevelUnits.length; i++) {
    const unit = parsed.topLevelUnits[i];
    for (let k = 0; k < unit.stages.length; k++) {
      const stageIndex = parseInt(unit.stages[k]);
      if (isNaN(stageIndex) || stageIndex < 0) {
        return `${i + 1}番目の最上位単位の${k + 1}番目の作業段階インデックスが無効です（0以上の整数である必要があります）。`;
      }
    }
  }

  return null;
};

/**
 * パース結果を作品作成用の構造データに変換する
 * @param parsed パース結果
 * @returns 作品構造データ
 */
export const convertToWorkStructure = (parsed: ParsedStructure): WorkStructure => {
  // 3階層の場合は中間ユニット数が実際の最上位ユニット数になる
  let actualTopLevelUnits = 0;
  parsed.topLevelUnits.forEach(unit => {
    if (unit.subUnits && unit.subUnits.length > 1) {
      actualTopLevelUnits += unit.subUnits.length;
    } else {
      actualTopLevelUnits += 1;
    }
  });

  const totalLeafUnits = parsed.topLevelUnits.reduce((sum, unit) => sum + unit.stages.length, 0);

  // 3階層の場合は各中間ユニットのleaf数を取得
  const leafUnitsPerTopUnit: number[] = [];
  parsed.topLevelUnits.forEach(unit => {
    if (unit.subUnits && unit.subUnits.length > 1) {
      unit.subUnits.forEach(subUnit => {
        leafUnitsPerTopUnit.push(subUnit.count);
      });
    } else {
      leafUnitsPerTopUnit.push(unit.stages.length);
    }
  });

  // 構造データの作成（作品作成用）
  const structureData: StructureData[] = [];
  const hierarchicalStructureData: HierarchicalStructureData[] = [];
  let isHierarchical = false;

  parsed.topLevelUnits.forEach(unit => {
    if (unit.subUnits && unit.subUnits.length > 1) {
      // 3階層以上の場合：階層構造データを作成
      isHierarchical = true;

      const children = unit.subUnits.map(subUnit => ({
        leafCount: subUnit.count,
        stageIndices: subUnit.stages.map(s => {
          // ユーザー入力を0ベースインデックスに変換（1=未着手 → 0=未着手）
          return isNaN(s) ? 0 : Math.max(0, s - 1);
        })
      }));

      hierarchicalStructureData.push({ children });

      // 後方互換性のため、従来のstructureDataも生成（平坦化）
      unit.subUnits.forEach(subUnit => {
        structureData.push({
          leafCount: subUnit.count,
          stageIndices: subUnit.stages.map(s => {
            return isNaN(s) ? 0 : Math.max(0, s - 1);
          })
        });
      });
    } else {
      // 2階層の場合：従来通り
      structureData.push({
        leafCount: unit.stages.length,
        stageIndices: unit.stages.map(s => {
          const userStageIndex = parseInt(s, 10);
          // ユーザー入力を0ベースインデックスに変換（1=未着手 → 0=未着手）
          return isNaN(userStageIndex) ? 0 : Math.max(0, userStageIndex - 1);
        })
      });
    }
  });

  // 全作業段階インデックス（作品更新用）
  const allStageIndices: number[] = [];
  parsed.topLevelUnits.forEach((topUnit) => {
    topUnit.stages.forEach((stageIndexStr) => {
      const userStageIndex = parseInt(stageIndexStr, 10);
      const systemStageIndex = isNaN(userStageIndex) ? 0 : Math.max(0, userStageIndex - 1);
      allStageIndices.push(systemStageIndex);
    });
  });

  const result = {
    topLevelUnits: isHierarchical ? parsed.topLevelUnits.length : actualTopLevelUnits,
    totalLeafUnits,
    leafUnitsPerTopUnit,
    structureData,
    hierarchicalStructureData: isHierarchical ? hierarchicalStructureData : undefined,
    allStageIndices
  };

  console.log('convertToWorkStructure結果:', {
    isHierarchical,
    topLevelUnits: result.topLevelUnits,
    structureDataLength: result.structureData.length,
    hierarchicalStructureDataLength: result.hierarchicalStructureData?.length || 0
  });

  return result;
};

/**
 * ユーザー入力の作業段階をシステムの0ベースインデックスに変換
 * @param userStageIndex ユーザー入力の作業段階（1=未着手, 2=ネーム済, etc）
 * @returns システムの作業段階（0=未着手, 1=ネーム済, etc）
 */
export const convertUserStageToSystemStage = (userStageIndex: number): number => {
  return isNaN(userStageIndex) ? 0 : Math.max(0, userStageIndex - 1);
};

/**
 * システムの0ベースインデックスをユーザー表示用の1ベースに変換
 * @param systemStageIndex システムの作業段階（0=未着手, 1=ネーム済, etc）
 * @returns ユーザー表示用の作業段階（1=未着手, 2=ネーム済, etc）
 */
export const convertSystemStageToUserStage = (systemStageIndex: number): number => {
  return Math.max(1, systemStageIndex + 1);
};

/**
 * 最下位レベルの親ユニット（leaf unitを直接持つユニット）を取得する関数
 * @param unit WorkUnit
 * @returns 最下位レベルの親ユニットの配列
 */
const getLeafParentUnits = (unit: WorkUnit): WorkUnit[] => {
  if (!unit.children || unit.children.length === 0) {
    return [];
  }

  // 子がすべて leaf unit（stageIndexを持つ）の場合、このユニットは leaf parent
  const allChildrenAreLeaves = unit.children.every(child =>
    typeof child.stageIndex === 'number' && (!child.children || child.children.length === 0)
  );

  if (allChildrenAreLeaves) {
    return [unit];
  }

  // そうでなければ、子ユニットを再帰的に処理
  const leafParents: WorkUnit[] = [];
  unit.children.forEach(child => {
    leafParents.push(...getLeafParentUnits(child));
  });
  return leafParents;
};

/**
 * WorkUnit配列から構造文字列を生成する
 * @param units WorkUnit配列
 * @param expectedDepth 期待される階層数（粒度設定から取得）
 * @returns 構造指定文字列
 */
export const convertWorkUnitsToStructureString = (units: WorkUnit[], expectedDepth?: number): string => {
  if (!units || units.length === 0) {
    return "構造が設定されていません";
  }

  const structureParts: string[] = [];

  units.forEach(unit => {
    // 実際の構造を分析
    const leafParentUnits = getLeafParentUnits(unit);

    // 期待される階層数に基づいて処理を分岐
    if (expectedDepth === 2) {
      // 2階層構造の場合：直接の子が最下位ユニット
      if (unit.children && unit.children.length > 0) {
        const allChildrenAreLeaves = unit.children.every(child =>
          typeof child.stageIndex === 'number' && (!child.children || child.children.length === 0)
        );

        if (allChildrenAreLeaves) {
          // 2階層構造：[1/2/3/4]
          const stageIndices = unit.children.map(child => (child.stageIndex + 1).toString());
          const structurePart = `[${stageIndices.join('/')}]`;
          structureParts.push(structurePart);
        }
      }
    } else if (expectedDepth === 3) {
      // 3階層構造の場合：中間レベルが存在
      if (leafParentUnits.length > 0) {
        const subParts: string[] = [];
        leafParentUnits.forEach(parent => {
          if (parent.children && parent.children.length > 0) {
            const stageIndices = parent.children.map(child => (child.stageIndex + 1).toString());
            subParts.push(stageIndices.join('/'));
          }
        });

        // 3階層構造：[[1/2/3][4/5/6]]
        const structurePart = `[[${subParts.join('][')}]]`;
        structureParts.push(structurePart);
      }
    } else {
      // 階層数が不明の場合：構造を自動判定
      if (leafParentUnits.length > 0) {
        // 3階層以上と判定
        const subParts: string[] = [];
        leafParentUnits.forEach(parent => {
          if (parent.children && parent.children.length > 0) {
            const stageIndices = parent.children.map(child => (child.stageIndex + 1).toString());
            subParts.push(stageIndices.join('/'));
          }
        });
        const structurePart = `[[${subParts.join('][')}]]`;
        structureParts.push(structurePart);
      } else {
        // 2階層と判定
        if (unit.children && unit.children.length > 0) {
          const allChildrenAreLeaves = unit.children.every(child =>
            typeof child.stageIndex === 'number'
          );

          if (allChildrenAreLeaves) {
            const stageIndices = unit.children.map(child => (child.stageIndex + 1).toString());
            const structurePart = `[${stageIndices.join('/')}]`;
            structureParts.push(structurePart);
          }
        }
      }
    }
  });

  return structureParts.join(',');
};
