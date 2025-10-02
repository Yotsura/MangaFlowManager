<script setup lang="ts">
import { computed, reactive, watch } from "vue";

import type { WorkPage } from "@/store/worksStore";

const props = defineProps<{
  pages: WorkPage[];
  stageLabels: string[];
  stageCount: number;
  defaultPanels: number;
}>();

const emit = defineEmits<{
  (event: "advance", pageId: string): void;
  (event: "update-panel", payload: { pageId: string; panelCount: number }): void;
  (event: "move-page", payload: { pageId: string; position: string }): void;
  (event: "add-page"): void;
}>();

const sortedPages = computed(() => [...props.pages].sort((a, b) => a.index - b.index));

const moveTargets = reactive<Record<string, string>>({});

watch(
  sortedPages,
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
  { immediate: true },
);

const progressRatio = (page: WorkPage) => {
  if (props.stageCount <= 0) {
    return 0;
  }
  return Math.min(page.stageIndex + 1, props.stageCount) / props.stageCount;
};

const progressPercent = (page: WorkPage) => Math.round(progressRatio(page) * 100);

const heatmapClass = (page: WorkPage) => {
  const ratio = progressRatio(page);
  if (ratio === 0) {
    return "heatmap-none";
  }
  if (ratio < 0.34) {
    return "heatmap-low";
  }
  if (ratio < 0.67) {
    return "heatmap-mid";
  }
  if (ratio < 1) {
    return "heatmap-high";
  }
  return "heatmap-complete";
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
</script>

<template>
  <div class="page-board">
    <div v-for="page in sortedPages" :key="page.id" class="page-card card shadow-sm">
      <div class="card-body d-flex flex-column gap-3">
        <div class="d-flex justify-content-between align-items-center">
          <span class="badge text-bg-secondary">#{{ page.index }}</span>
          <button type="button" class="btn btn-sm btn-outline-primary" :disabled="stageCount === 0" @click="emit('advance', page.id)">
            {{ stageLabelFor(page) }}
          </button>
        </div>

        <div class="progress" role="progressbar" :aria-valuenow="progressPercent(page)" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-bar" :class="heatmapClass(page)" :style="{ width: `${progressPercent(page)}%` }">
            {{ progressPercent(page) }}%
          </div>
        </div>

        <div class="page-settings">
          <div>
            <label class="form-label form-label-sm" :for="`panel-count-${page.id}`">コマ数</label>
            <input
              :id="`panel-count-${page.id}`"
              type="number"
              min="1"
              class="form-control form-control-sm"
              :value="page.panelCount"
              @change="updatePanelCount(page.id, ($event.target as HTMLInputElement).value)"
            />
          </div>

          <div>
            <label class="form-label form-label-sm" :for="`move-select-${page.id}`">ページ移動</label>
            <div class="input-group input-group-sm">
              <select
                :id="`move-select-${page.id}`"
                v-model="moveTargets[page.id]"
                class="form-select"
              >
                <option value="__start">先頭</option>
                <option
                  v-for="other in sortedPages"
                  :key="`option-${page.id}-${other.id}`"
                  :value="other.id"
                  :disabled="other.id === page.id"
                >
                  #{{ other.index }} の後
                </option>
                <option value="__end">末尾</option>
              </select>
              <button type="button" class="btn btn-outline-secondary" @click="submitMove(page.id)">移動</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <button type="button" class="add-card card border-dashed" @click="emit('add-page')">
      <div class="card-body d-flex flex-column align-items-center justify-content-center text-muted">
        <span class="display-6 mb-2">＋</span>
        <span>ページを追加</span>
        <small class="text-muted">既定コマ数: {{ defaultPanels }}</small>
      </div>
    </button>
  </div>
</template>

<style scoped>
.page-board {
  display: flex;
  flex-wrap: wrap;
  flex-direction: row-reverse;
  gap: 1rem;
}

.page-card,
.add-card {
  width: min(16rem, 100%);
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

.heatmap-none {
  background-color: #dee2e6;
  color: #495057;
}

.heatmap-low {
  background-color: #f8d7da;
  color: #842029;
}

.heatmap-mid {
  background-color: #fff3cd;
  color: #856404;
}

.heatmap-high {
  background-color: #cfe2ff;
  color: #084298;
}

.heatmap-complete {
  background-color: #d1e7dd;
  color: #0f5132;
}

@media (min-width: 1200px) {
  .page-settings {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
