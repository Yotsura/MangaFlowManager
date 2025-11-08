import type { Work, WorkDocument, WorkUnit, LegacyWork, LegacyPage, LegacyPanel } from "@/types/work";
import { WORK_STATUSES } from "@/types/work";
import { generateId } from "@/utils/id";

/**
 * ユニットを正規化
 */
export const normalizeUnit = (raw: unknown, fallbackIndex: number, isLeafLevel?: boolean): WorkUnit | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const data = raw as Record<string, unknown>;

  const id = typeof data.id === "string" && data.id.trim().length > 0 ? data.id : generateId();
  const indexRaw = Number(data.index);
  const index = Number.isFinite(indexRaw) && indexRaw > 0 ? Math.floor(indexRaw) : fallbackIndex;

  // stageIndexの有無で最下位粒度かどうかを自動判定
  const hasStageIndex = data.stageIndex !== undefined && data.stageIndex !== null;
  const hasChildren = Array.isArray(data.children) && data.children.length > 0;

  // isLeafLevelが明示的に指定されていない場合は自動判定
  const actualIsLeaf = isLeafLevel !== undefined ? isLeafLevel : hasStageIndex && !hasChildren;

  if (actualIsLeaf || hasStageIndex) {
    // 最下位粒度: stageIndexを持つ
    const stageRaw = Number(data.stageIndex);
    const stageIndex = Number.isFinite(stageRaw) && stageRaw >= 0 ? Math.floor(stageRaw) : 0;

    return {
      id,
      index,
      stageIndex,
    } satisfies WorkUnit;
  } else {
    // 中間粒度: childrenを持つ
    let children: WorkUnit[] = [];

    if (Array.isArray(data.children)) {
      children = data.children
        .map((childRaw, childIndex) => normalizeUnit(childRaw, childIndex + 1))
        .filter((child): child is WorkUnit => child !== null)
        .map((child, childIndex) => ({ ...child, index: childIndex + 1 }));
    }

    return {
      id,
      index,
      children,
    } satisfies WorkUnit;
  }
};

/**
 * Firestoreドキュメントを作品オブジェクトにマッピング
 */
export const mapDocumentToWork = (item: WorkDocument & { id: string }): Work => {
  const createdAt = typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString();
  const updatedAt = typeof item.updatedAt === "string" ? item.updatedAt : createdAt;

  // 新形式のunitsまたは旧形式のpagesを処理
  let units: WorkUnit[] = [];
  let defaultCounts: number[] = [];

  const legacyItem = item as unknown as LegacyWork;

  if (Array.isArray(legacyItem.units)) {
    // 新形式: unitsプロパティがある場合
    units = (legacyItem.units as unknown[])
      .map((unitRaw: unknown, index: number) => normalizeUnit(unitRaw, index + 1))
      .filter((unit: WorkUnit | null): unit is WorkUnit => unit !== null)
      .map((unit: WorkUnit, index: number) => ({ ...unit, index: index + 1 }));

    defaultCounts = Array.isArray(legacyItem.defaultCounts) ? (legacyItem.defaultCounts as number[]) : [1];
  } else if (Array.isArray(legacyItem.pages)) {
    // 旧形式からの移行: pagesをunitsに変換
    const pagesRaw = legacyItem.pages;
    units = pagesRaw
      .map((pageRaw: LegacyPage, index: number) => {
        // 旧形式のpageをunit構造に変換
        return normalizeUnit(
          {
            id: pageRaw.id || generateId(),
            index: index + 1,
            children: Array.isArray(pageRaw.panels)
              ? pageRaw.panels.map((panel: LegacyPanel, panelIndex: number) => ({
                  id: panel.id || generateId(),
                  index: panelIndex + 1,
                  stageIndex: panel.stageIndex || 0,
                }))
              : Array.from({ length: pageRaw.panelCount || 1 }, (_, panelIndex) => ({
                  id: generateId(),
                  index: panelIndex + 1,
                  stageIndex: pageRaw.stageIndex || 0,
                })),
          },
          index + 1,
          false
        );
      })
      .filter((unit: WorkUnit | null): unit is WorkUnit => unit !== null);

    const defaultPanels =
      Number.isFinite(Number(legacyItem.defaultPanelsPerPage)) && Number(legacyItem.defaultPanelsPerPage) > 0
        ? Math.floor(Number(legacyItem.defaultPanelsPerPage))
        : 1;
    defaultCounts = [defaultPanels];
  }

  const totalUnits =
    Number.isFinite(Number(item.totalUnits)) && Number(item.totalUnits) > 0
      ? Math.floor(Number(item.totalUnits))
      : units.length;
  const unitEstimatedHours =
    Number.isFinite(Number(item.unitEstimatedHours)) && Number(item.unitEstimatedHours) >= 0
      ? Number(item.unitEstimatedHours)
      : 0;
  const totalEstimatedHours =
    Number.isFinite(Number(item.totalEstimatedHours)) && Number(item.totalEstimatedHours) >= 0
      ? Number(item.totalEstimatedHours)
      : Number((totalUnits * unitEstimatedHours).toFixed(2));

  return {
    id: item.id,
    title: typeof item.title === "string" ? item.title : "",
    status: WORK_STATUSES.includes(item.status as (typeof WORK_STATUSES)[number])
      ? (item.status as (typeof WORK_STATUSES)[number])
      : WORK_STATUSES[0],
    startDate: typeof item.startDate === "string" ? item.startDate : "",
    deadline: typeof item.deadline === "string" ? item.deadline : "",
    createdAt,
    updatedAt,
    totalUnits,
    defaultCounts,
    primaryGranularityId: typeof item.primaryGranularityId === "string" ? item.primaryGranularityId : null,
    unitEstimatedHours,
    totalEstimatedHours,
    units,
    workGranularities: Array.isArray(item.workGranularities) ? item.workGranularities : [],
    workStageWorkloads: Array.isArray(item.workStageWorkloads) ? item.workStageWorkloads : [],
    progressHistory: Array.isArray(item.progressHistory) ? item.progressHistory : [],
  };
};

interface SerializedWorkUnit {
  id: string;
  index: number;
  children?: SerializedWorkUnit[];
  stageIndex?: number;
}

/**
 * ユニットをシリアライズ
 */
export const serializeWorkUnit = (unit: WorkUnit): SerializedWorkUnit => {
  const result: SerializedWorkUnit = {
    id: unit.id,
    index: unit.index,
  };

  if (unit.stageIndex !== undefined) {
    // 最下位粒度
    result.stageIndex = unit.stageIndex;
  } else if (unit.children) {
    // 中間粒度
    result.children = unit.children.map(serializeWorkUnit);
  }

  return result;
};

/**
 * 作品オブジェクトをFirestoreドキュメントにシリアライズ
 */
export const serializeWork = (work: Work): WorkDocument => ({
  title: work.title,
  status: work.status,
  startDate: work.startDate,
  deadline: work.deadline,
  createdAt: work.createdAt,
  updatedAt: work.updatedAt,
  totalUnits: work.totalUnits,
  defaultCounts: work.defaultCounts,
  primaryGranularityId: work.primaryGranularityId,
  unitEstimatedHours: work.unitEstimatedHours,
  totalEstimatedHours: work.totalEstimatedHours,
  units: work.units.map(serializeWorkUnit),
  workGranularities: work.workGranularities || [],
  workStageWorkloads: work.workStageWorkloads || [],
  progressHistory: work.progressHistory || [],
});
