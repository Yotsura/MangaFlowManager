<script setup lang="ts">
import { computed } from "vue";

import { stageColorFor } from "@/modules/works/utils/stageColor";
import type { WorkUnit } from "@/store/worksStore";

const props = defineProps<{
  units: WorkUnit[];
  stageCount: number;
  stageLabels: string[];
  stageColors?: string[];
}>();

// 最下位レベルのユニット（stageIndexを持つもの）を再帰的に収集
const collectLeafUnits = (units: WorkUnit[]): WorkUnit[] => {
  const result: WorkUnit[] = [];
  for (const unit of units) {
    if (unit.stageIndex !== undefined) {
      result.push(unit);
    } else if (unit.children) {
      result.push(...collectLeafUnits(unit.children));
    }
  }
  return result;
};

const sortedUnits = computed(() => collectLeafUnits(props.units).sort((a, b) => a.index - b.index));

const cellStyle = (unit: WorkUnit) => {
  const stageIndex = unit.stageIndex ?? 0;
  const override = props.stageColors?.[stageIndex];
  const { backgroundColor, textColor } = stageColorFor(stageIndex, props.stageCount, override);
  return {
    backgroundColor,
    color: textColor,
  };
};

const stageLabelFor = (unit: WorkUnit) => props.stageLabels[unit.stageIndex ?? 0] ?? "未設定";
</script>

<template>
  <div class="heatmap-wrapper" role="grid" aria-label="ページ進捗のヒートマップ">
    <template v-if="sortedUnits.length">
      <div v-for="unit in sortedUnits" :key="unit.id" class="heatmap-cell" :style="cellStyle(unit)" role="gridcell">
        <span class="cell-index">#{{ unit.index }}</span>
        <span class="cell-stage">{{ stageLabelFor(unit) }}</span>
      </div>
    </template>
    <p v-else class="text-muted mb-0">ユニットが登録されていません。</p>
  </div>
</template>

<style scoped>
.heatmap-wrapper {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(5rem, 1fr));
  gap: 0.75rem;
}

.heatmap-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 0.5rem;
  border-radius: 0.75rem;
  background-color: #e9ecef;
  text-align: center;
  min-height: 4.5rem;
  transition: transform 0.2s ease;
}

.heatmap-cell:hover {
  transform: translateY(-2px);
}

.cell-index {
  font-weight: 600;
  font-size: 0.85rem;
}

.cell-stage {
  font-size: 0.7rem;
  color: #495057;
}

/* Colors are provided dynamically via inline styles */
</style>
