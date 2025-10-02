<script setup lang="ts">
import { computed, reactive, watch } from "vue";

import { stageColorFor } from "@/modules/works/utils/stageColor";
import type { WorkPage } from "@/store/worksStore";

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
}>();

const emit = defineEmits<{
  (event: "advance", pageId: string): void;
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

const progressRatio = (page: WorkPage) => {
  if (props.stageCount <= 0) {
    return 0;
  }
  return Math.min(page.stageIndex + 1, props.stageCount) / props.stageCount;
};

const progressPercent = (page: WorkPage) => Math.round(progressRatio(page) * 100);

const progressStyle = (page: WorkPage) => {
  const override = props.stageColors?.[page.stageIndex];
  const { backgroundColor, textColor } = stageColorFor(page.stageIndex, props.stageCount, override);
  return {
    width: `${progressPercent(page)}%`,
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

const stageLabelFor = (page: WorkPage) => props.stageLabels[page.stageIndex] ?? "未設定";

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
              <div class="d-flex gap-2">
                <button type="button" class="btn btn-sm btn-outline-primary" :disabled="stageCount === 0" @click="emit('advance', cell.page.id)">
                  {{ stageLabelFor(cell.page) }}
                </button>
                <button type="button" class="btn btn-sm btn-outline-danger" @click="emit('remove-page', cell.page.id)">削除</button>
              </div>
            </div>

            <div class="progress" role="progressbar" :aria-valuenow="progressPercent(cell.page)" aria-valuemin="0" aria-valuemax="100">
              <div class="progress-bar" :style="progressStyle(cell.page)">
                {{ progressPercent(cell.page) }}%
              </div>
            </div>

            <div class="page-settings">
              <div>
                <label class="form-label form-label-sm" :for="`panel-count-${cell.page.id}`">コマ数</label>
                <input
                  :id="`panel-count-${cell.page.id}`"
                  type="number"
                  min="1"
                  class="form-control form-control-sm"
                  :value="cell.page.panelCount"
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

        <button v-else-if="cell.kind === 'adder'" type="button" class="page-card add-card card border-dashed" @click="emit('add-page')">
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


@media (max-width: 991.98px) {
  .page-row--first {
    grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
  }

  .page-row:not(.page-row--first) {
    grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
  }
}

@media (min-width: 1200px) {
  .page-settings {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
