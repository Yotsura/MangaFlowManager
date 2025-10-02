<script setup lang="ts">
import { computed, reactive, watch } from "vue";

import { stageColorFor } from "@/modules/works/utils/stageColor";
import type { WorkPage, WorkPanel } from "@/store/worksStore";

const FIRST_ROW_SLOTS = 4;
const OTHER_ROW_SLOTS = 4;

type RenderCell =
  | { kind: "page"; page: WorkPage }
  | { kind: "adder" }
  | { kind: "placeholder"; key: string };

const props = defineProps<{
  pages: WorkPage[];
  stageLabels: string[];
  stageCount: number;
  stageColors?: string[];
  defaultPanels: number;
  isEditMode?: boolean;
  savingPanelIds?: Set<string>;
}>();

const emit = defineEmits<{
  (event: "advance-panel", payload: { pageId: string; panelId: string }): void;
  (event: "update-panel", payload: { pageId: string; panelCount: number }): void;
  (event: "move-page", payload: { pageId: string; position: string }): void;
  (event: "remove-page", pageId: string): void;
  (event: "add-page"): void;
}>();

const sortedPages = computed(() => [...props.pages].sort((a, b) => a.index - b.index));

const moveTargets = reactive<Record<string, string>>({});

watch(
  () => props.pages,
  (current) => {
    current.forEach((page) => {
      if (!moveTargets[page.id]) {
        moveTargets[page.id] = "__end";
      }
    });
    Object.keys(moveTargets).forEach((key) => {
      if (!current.some((page) => page.id === key)) {
        delete moveTargets[key];
      }
    });
  },
  { immediate: true, deep: true },
);

const createPlaceholder = (rowIndex: number, columnIndex: number): RenderCell => ({
  kind: "placeholder",
  key: `placeholder-${rowIndex}-${columnIndex}`,
});

const buildRow = (params: {
  rowIndex: number;
  capacity: number;
  reserveRightmost?: boolean;
  remaining: RenderCell[];
}): RenderCell[] => {
  const { rowIndex, capacity, reserveRightmost = false, remaining } = params;
  const reservedIndices = new Set<number>();
  if (reserveRightmost) {
    reservedIndices.add(capacity - 1);
  }

  const slotsToFill = capacity - reservedIndices.size;
  const rowEntries: RenderCell[] = [];
  while (rowEntries.length < slotsToFill && remaining.length > 0) {
    rowEntries.push(remaining.shift()!);
  }

  const positioned: RenderCell[] = Array.from({ length: capacity }, (_, columnIndex) => createPlaceholder(rowIndex, columnIndex));

  reservedIndices.forEach((index) => {
    positioned[index] = createPlaceholder(rowIndex, index);
  });

  let fillIndex = capacity - 1;
  for (const entry of rowEntries) {
    while (reservedIndices.has(fillIndex) && fillIndex >= 0) {
      fillIndex -= 1;
    }
    if (fillIndex < 0) {
      break;
    }
    positioned[fillIndex] = entry;
    fillIndex -= 1;
  }

  return positioned;
};

const pageRows = computed(() => {
  const baseCells: RenderCell[] = sortedPages.value.map((page) => ({ kind: "page", page }));
  baseCells.push({ kind: "adder" });

  const remaining = [...baseCells];
  const rows: RenderCell[][] = [];

  rows.push(buildRow({ rowIndex: 0, capacity: FIRST_ROW_SLOTS, reserveRightmost: true, remaining }));

  let rowIndex = 1;
  while (remaining.length > 0) {
    rows.push(buildRow({ rowIndex, capacity: OTHER_ROW_SLOTS, remaining }));
    rowIndex += 1;
  }

  return rows;
});

const pageProgressRatio = (page: WorkPage) => {
  if (props.stageCount <= 0 || page.panels.length === 0) {
    return 0;
  }

  const totalProgress = page.panels.reduce((sum, panel) => {
    return sum + Math.min(panel.stageIndex + 1, props.stageCount);
  }, 0);

  const maxProgress = page.panels.length * props.stageCount;
  return totalProgress / maxProgress;
};

const pageProgressPercent = (page: WorkPage) => Math.round(pageProgressRatio(page) * 100);

const pageProgressStyle = (page: WorkPage) => {
  // ページ全体の平均的な段階を計算
  const averageStage = page.panels.length > 0
    ? Math.floor(page.panels.reduce((sum, panel) => sum + panel.stageIndex, 0) / page.panels.length)
    : 0;

  const override = props.stageColors?.[averageStage];
  const { backgroundColor, textColor } = stageColorFor(averageStage, props.stageCount, override);
  return {
    width: `${pageProgressPercent(page)}%`,
    backgroundColor,
    color: textColor,
  };
};

const updatePanelCount = (pageId: string, value: string) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return;
  }
  emit("update-panel", { pageId, panelCount: numeric });
};

const submitMove = (pageId: string) => {
  emit("move-page", { pageId, position: moveTargets[pageId] ?? "__end" });
};

const stageLabelFor = (stageIndex: number) => props.stageLabels[stageIndex] ?? "未設定";

const panelButtonStyle = (panel: WorkPanel) => {
  const override = props.stageColors?.[panel.stageIndex];
  const { backgroundColor, textColor } = stageColorFor(panel.stageIndex, props.stageCount, override);
  return {
    backgroundColor,
    color: textColor,
    borderColor: backgroundColor,
  };
};

const cellKey = (cell: RenderCell, index: number) => {
  if (cell.kind === "page") {
    return cell.page.id;
  }
  if (cell.kind === "adder") {
    return "adder";
  }
  return `${cell.key}-${index}`;
};
</script>

<template>
  <div class="page-board">
    <div
      v-for="(row, rowIndex) in pageRows"
      :key="`row-${rowIndex}`"
      :class="['page-row', { 'page-row--first': rowIndex === 0 }]"
    >
      <template v-for="(cell, cellIndex) in row" :key="cellKey(cell, cellIndex)">
        <div v-if="cell.kind === 'page'" class="page-card card shadow-sm">
          <div class="card-body d-flex flex-column gap-3">
            <div class="d-flex justify-content-between align-items-start gap-2">
              <span class="badge text-bg-secondary">#{{ cell.page.index }}</span>
              <button v-if="isEditMode" type="button" class="btn btn-sm btn-outline-danger" @click="emit('remove-page', cell.page.id)">削除</button>
            </div>

            <div class="progress" role="progressbar" :aria-valuenow="pageProgressPercent(cell.page)" aria-valuemin="0" aria-valuemax="100">
              <div class="progress-bar" :style="pageProgressStyle(cell.page)">
                {{ pageProgressPercent(cell.page) }}%
              </div>
            </div>

            <!-- コマごとの進捗ボタン -->
            <div v-if="!isEditMode" class="panels-grid">
              <button
                v-for="panel in cell.page.panels"
                :key="panel.id"
                type="button"
                class="panel-btn"
                :style="panelButtonStyle(panel)"
                :disabled="stageCount === 0 || savingPanelIds?.has(panel.id)"
                @click="emit('advance-panel', { pageId: cell.page.id, panelId: panel.id })"
              >
                <span class="panel-number">{{ panel.index }}</span><span class="panel-stage">{{ stageLabelFor(panel.stageIndex) }}</span>
              </button>
            </div>
            <div v-else class="page-settings">
              <div>
                <label class="form-label form-label-sm" :for="`panel-count-${cell.page.id}`">コマ数</label>
                <input
                  :id="`panel-count-${cell.page.id}`"
                  type="number"
                  min="1"
                  class="form-control form-control-sm"
                  :value="cell.page.panels.length"
                  @change="updatePanelCount(cell.page.id, ($event.target as HTMLInputElement).value)"
                />
              </div>

              <div>
                <label class="form-label form-label-sm" :for="`move-select-${cell.page.id}`">ページ移動</label>
                <div class="input-group input-group-sm">
                  <select
                    :id="`move-select-${cell.page.id}`"
                    v-model="moveTargets[cell.page.id]"
                    class="form-select"
                  >
                    <option value="__start">先頭</option>
                    <option
                      v-for="other in sortedPages"
                      :key="`option-${cell.page.id}-${other.id}`"
                      :value="other.id"
                      :disabled="other.id === cell.page.id"
                    >
                      #{{ other.index }} の後
                    </option>
                    <option value="__end">末尾</option>
                  </select>
                  <button type="button" class="btn btn-outline-secondary" @click="submitMove(cell.page.id)">移動</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <button v-else-if="cell.kind === 'adder' && isEditMode" type="button" class="page-card add-card card border-dashed" @click="emit('add-page')">
          <div class="card-body d-flex flex-column align-items-center justify-content-center text-muted">
            <span class="display-6 mb-2">＋</span>
            <span>ページを追加</span>
            <small class="text-muted">既定コマ数: {{ defaultPanels }}</small>
          </div>
        </button>

        <div v-else class="page-card placeholder-card card">
          <div class="card-body"></div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.page-board {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.page-row {
  display: grid;
  gap: 1rem;
}

.page-row--first {
  grid-template-columns: repeat(4, minmax(12rem, 1fr));
}

.page-row:not(.page-row--first) {
  grid-template-columns: repeat(4, minmax(10rem, 1fr));
}

.page-card {
  min-height: 100%;
}

.add-card {
  background-color: #f8f9fa;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.add-card:hover {
  background-color: #e2e6ea;
}

.border-dashed {
  border: 2px dashed #ced4da;
}

.placeholder-card {
  background-color: transparent;
  border: none;
}

.page-settings {
  display: grid;
  gap: 0.75rem;
}

.form-label-sm {
  font-size: 0.8rem;
  margin-bottom: 0.25rem;
}

.progress {
  height: 0.85rem;
  background-color: #f1f3f5;
}

.progress-bar {
  font-size: 0.7rem;
  line-height: 0.7rem;
}

.panels-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
  gap: 0.25rem;
}

.panel-btn {
  border: 1px solid;
  border-radius: 0.25rem;
  padding: 0.125rem 0.25rem;
  font-size: 0.625rem;
  line-height: 1.1;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
  min-height: 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.panel-btn:hover:not(:disabled) {
  filter: brightness(0.9);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.panel-btn:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.panel-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  filter: grayscale(0.3);
}

.panel-number {
  font-weight: 600;
  font-size: 0.625rem;
  line-height: 1;
}

.panel-stage {
  font-size: 0.55rem;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}


@media (max-width: 991.98px) {
  .page-row--first {
    grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
  }

  .page-row:not(.page-row--first) {
    grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
  }

  .panels-grid {
    grid-template-columns: repeat(auto-fill, minmax(45px, 1fr));
    gap: 0.2rem;
  }

  .panel-btn {
    min-height: 28px;
    padding: 0.1rem 0.2rem;
  }

  .panel-number {
    font-size: 0.6rem;
  }

  .panel-stage {
    font-size: 0.5rem;
  }
}

@media (min-width: 1200px) {
  .page-settings {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .panels-grid {
    grid-template-columns: repeat(auto-fill, minmax(55px, 1fr));
  }
}
</style>
