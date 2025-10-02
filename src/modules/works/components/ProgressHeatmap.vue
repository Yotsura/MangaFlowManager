<script setup lang="ts">
import { computed } from "vue";

import { stageColorFor } from "@/modules/works/utils/stageColor";
import type { WorkPage } from "@/store/worksStore";

const props = defineProps<{
  pages: WorkPage[];
  stageCount: number;
  stageLabels: string[];
}>();

const sortedPages = computed(() => [...props.pages].sort((a, b) => a.index - b.index));

const cellStyle = (page: WorkPage) => {
  const { backgroundColor, textColor } = stageColorFor(page.stageIndex, props.stageCount);
  return {
    backgroundColor,
    color: textColor,
  };
};

const stageLabelFor = (page: WorkPage) => props.stageLabels[page.stageIndex] ?? "未設定";
</script>

<template>
  <div class="heatmap-wrapper" role="grid" aria-label="ページ進捗のヒートマップ">
    <template v-if="sortedPages.length">
      <div v-for="page in sortedPages" :key="page.id" class="heatmap-cell" :style="cellStyle(page)" role="gridcell">
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

/* Colors are provided dynamically via inline styles */
</style>
