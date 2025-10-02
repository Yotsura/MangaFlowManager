<script setup lang="ts">
import { computed } from "vue";

import type { WorkPage } from "@/store/worksStore";

const props = defineProps<{
  pages: WorkPage[];
  stageCount: number;
  stageLabels: string[];
}>();

const sortedPages = computed(() => [...props.pages].sort((a, b) => a.index - b.index));

const progressRatio = (page: WorkPage) => {
  if (props.stageCount <= 0) {
    return 0;
  }
  return Math.min(page.stageIndex + 1, props.stageCount) / props.stageCount;
};

const progressClass = (page: WorkPage) => {
  const ratio = progressRatio(page);
  if (ratio === 0) {
    return "cell-empty";
  }
  if (ratio < 0.34) {
    return "cell-low";
  }
  if (ratio < 0.67) {
    return "cell-mid";
  }
  if (ratio < 1) {
    return "cell-high";
  }
  return "cell-complete";
};

const stageLabelFor = (page: WorkPage) => props.stageLabels[page.stageIndex] ?? "未設定";
</script>

<template>
  <div class="heatmap-wrapper" role="grid" aria-label="ページ進捗のヒートマップ">
    <template v-if="sortedPages.length">
      <div v-for="page in sortedPages" :key="page.id" class="heatmap-cell" :class="progressClass(page)" role="gridcell">
        <span class="cell-index">#{{ page.index }}</span>
        <span class="cell-stage">{{ stageLabelFor(page) }}</span>
      </div>
    </template>
    <p v-else class="text-muted mb-0">ページが登録されていません。</p>
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

.cell-empty {
  background-color: #f1f3f5;
}

.cell-low {
  background-color: #ffe5d9;
  color: #7f2f1d;
}

.cell-mid {
  background-color: #fff3bf;
  color: #7c5b00;
}

.cell-high {
  background-color: #d0ebff;
  color: #0b7285;
}

.cell-complete {
  background-color: #d3f9d8;
  color: #2b8a3e;
}
</style>
