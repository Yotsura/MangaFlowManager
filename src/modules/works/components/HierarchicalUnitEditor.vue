<template>
  <div class="hierarchical-unit-editor">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h5 class="mb-0">作品構造</h5>
      <div class="btn-toolbar" role="toolbar">
        <div class="btn-group me-2" role="group">
          <button type="button" class="btn btn-sm btn-outline-primary" @click="expandAll" :disabled="!hasCollapsibleNodes">
            <i class="bi bi-arrows-expand me-1"></i>
            すべて展開
          </button>
          <button type="button" class="btn btn-sm btn-outline-primary" @click="collapseAll" :disabled="!hasExpandedNodes">
            <i class="bi bi-arrows-collapse me-1"></i>
            すべて折りたたむ
          </button>
        </div>
        <div class="btn-group" role="group" v-if="isEditMode">
          <button type="button" class="btn btn-sm btn-success" @click="addRootUnit">
            <i class="bi bi-plus-lg me-1"></i>
            ルートユニット追加
          </button>
        </div>
      </div>
    </div>

    <div class="units-container">
      <div v-if="units.length === 0" class="text-center py-4 text-muted">
        <i class="bi bi-folder2-open display-4 d-block mb-2"></i>
        <p class="mb-0">まだユニットが作成されていません</p>
        <button v-if="isEditMode" type="button" class="btn btn-outline-primary btn-sm mt-2" @click="addRootUnit">最初のユニットを作成</button>
      </div>

      <HierarchicalUnitNode
        v-for="unit in units"
        :key="unit.id"
        :unit="unit"
        :level="0"
        :stage-count="stageCount"
        :stage-labels="stageLabels"
        :stage-colors="stageColors"
        :is-edit-mode="isEditMode"
        :expanded-nodes="expandedNodes"
        :saving-unit-ids="savingUnitIds"
        @toggle-expand="toggleExpand"
        @advance-stage="handleAdvanceStage"
        @add-child="handleAddChild"
        @remove-unit="handleRemoveUnit"
        @update-children-count="handleUpdateChildrenCount"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import HierarchicalUnitNode from "./HierarchicalUnitNode.vue";
import type { WorkUnit } from "@/store/worksStore";

interface Props {
  units: WorkUnit[];
  stageCount: number;
  stageLabels: string[];
  stageColors: string[];
  isEditMode: boolean;
  savingUnitIds: Set<string>;
}

interface Emits {
  (event: "advance-stage", payload: { unitId: string }): void;
  (event: "add-root-unit"): void;
  (event: "add-child", payload: { parentId: string }): void;
  (event: "remove-unit", payload: { unitId: string }): void;
  (event: "update-children-count", payload: { unitId: string; count: number }): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// 展開状態管理
const expandedNodes = ref<Set<string>>(new Set());

// 展開/折りたたみ制御
const hasCollapsibleNodes = computed(() => {
  const hasChildren = (units: WorkUnit[]): boolean => {
    return units.some((unit) => (unit.children && unit.children.length > 0) || (unit.children && hasChildren(unit.children)));
  };
  return hasChildren(props.units);
});

const hasExpandedNodes = computed(() => expandedNodes.value.size > 0);

const toggleExpand = (unitId: string) => {
  if (expandedNodes.value.has(unitId)) {
    expandedNodes.value.delete(unitId);
  } else {
    expandedNodes.value.add(unitId);
  }
};

const expandAll = () => {
  const collectIds = (units: WorkUnit[]): string[] => {
    const ids: string[] = [];
    for (const unit of units) {
      if (unit.children && unit.children.length > 0) {
        ids.push(unit.id);
        ids.push(...collectIds(unit.children));
      }
    }
    return ids;
  };

  const allIds = collectIds(props.units);
  expandedNodes.value = new Set(allIds);
};

const collapseAll = () => {
  expandedNodes.value.clear();
};

// イベントハンドラー
const handleAdvanceStage = (payload: { unitId: string }) => {
  emit("advance-stage", payload);
};

const addRootUnit = () => {
  emit("add-root-unit");
};

const handleAddChild = (payload: { parentId: string }) => {
  emit("add-child", payload);
};

const handleRemoveUnit = (payload: { unitId: string }) => {
  emit("remove-unit", payload);
};

const handleUpdateChildrenCount = (payload: { unitId: string; count: number }) => {
  emit("update-children-count", payload);
};
</script>

<style scoped>
.hierarchical-unit-editor {
  border: 1px solid var(--bs-border-color);
  border-radius: 0.375rem;
  padding: 1rem;
  background-color: var(--bs-body-bg);
}

.units-container {
  min-height: 200px;
}

.btn-toolbar .btn-group:not(:last-child) {
  margin-right: 0.5rem;
}
</style>
