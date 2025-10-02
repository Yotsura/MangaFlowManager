<template>
  <div class="panel-style-unit-editor">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h5 class="mb-0">作品構造</h5>
      <!-- <div v-if="isEditMode" class="btn-group" role="group">
        <button
          type="button"
          class="btn btn-sm btn-success"
          @click="addRootUnit"
        >
          + ルートユニット追加
        </button>
      </div> -->
    </div>

    <div class="panels-container">
      <div v-if="units.length === 0" class="empty-state">
        <div class="empty-panel">
          <button v-if="isEditMode" type="button" class="add-button" @click="addRootUnit">+</button>
          <div v-else class="empty-text">ユニットなし</div>
        </div>
      </div>

      <div v-else class="units-grid">
        <PanelStyleUnitPanel
          v-for="unit in units"
          :key="unit.id"
          :unit="unit"
          :level="0"
          :stage-count="stageCount"
          :stage-labels="stageLabels"
          :stage-colors="stageColors"
          :is-edit-mode="isEditMode"
          :saving-unit-ids="savingUnitIds"
          @advance-stage="handleAdvanceStage"
          @add-child="handleAddChild"
          @remove-unit="handleRemoveUnit"
          @update-children-count="handleUpdateChildrenCount"
        />

        <!-- 追加ボタンパネル -->
        <div v-if="isEditMode" class="add-panel">
          <button type="button" class="add-button" @click="addRootUnit">+</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import PanelStyleUnitPanel from "./PanelStyleUnitPanel.vue";
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
.panel-style-unit-editor {
  border: 1px solid var(--bs-border-color);
  border-radius: 0.375rem;
  padding: 1rem;
  background-color: var(--bs-body-bg);
}

.panels-container {
  min-height: 300px;
}

.units-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
  align-items: start;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}

.empty-panel,
.add-panel {
  border: 2px dashed var(--bs-border-color);
  border-radius: 0.5rem;
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bs-gray-50);
  transition: all 0.2s ease;
}

.empty-panel:hover,
.add-panel:hover {
  border-color: var(--bs-primary);
  background-color: var(--bs-primary-bg-subtle);
}

.add-button {
  background: none;
  border: none;
  font-size: 3rem;
  color: var(--bs-gray-500);
  cursor: pointer;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.add-button:hover {
  color: var(--bs-primary);
  background-color: var(--bs-primary-bg-subtle);
  transform: scale(1.1);
}

.empty-text {
  color: var(--bs-gray-500);
  font-size: 1.1rem;
}

@media (max-width: 768px) {
  .units-grid {
    grid-template-columns: 1fr;
  }
}
</style>
