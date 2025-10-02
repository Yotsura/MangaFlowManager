<template>
  <!-- 最下位ユニットの場合は枠無しで直接ボタンを返す -->
  <LeafUnitButton
    v-if="isLeafUnit"
    :unit="unit"
    :stage-count="stageCount"
    :stage-labels="stageLabels"
    :stage-colors="stageColors"
    :is-edit-mode="isEditMode"
    :saving-unit-ids="savingUnitIds"
    @advance-stage="$emit('advance-stage', $event)"
    @remove-unit="$emit('remove-unit', $event)"
  />

  <!-- 中間ユニットの場合はパネル表示 -->
  <div v-else class="unit-panel" :class="{ 'is-saving': isSaving, [`level-${level}`]: true }" >
    <!-- パネルヘッダー -->
    <div class="panel-header">
      <div class="panel-info">
        <span class="panel-index">#{{ unit.index }}</span>
        <span class="panel-type">{{ panelTypeLabel }}</span>
      </div>
      <div v-if="isEditMode" class="panel-actions">
        <button type="button" class="action-btn remove-btn"
           @click.stop="handleRemove" title="削除">×</button>
      </div>
    </div>

    <!-- 中間ユニットの場合：子ユニットのグリッド -->
    <div class="panel-content children-content">
      <div v-if="hasChildren" class="children-container">

        <!-- 全ての子が葉ユニットの場合：レスポンシブグリッド表示 -->
        <div v-if="allChildrenAreLeaf" class="leaf-units-grid">
          <LeafUnitButton
            v-for="child in unit.children"
            :key="child.id"
            :unit="child"
            :stage-count="stageCount"
            :stage-labels="stageLabels"
            :stage-colors="stageColors"
            :is-edit-mode="isEditMode"
            :saving-unit-ids="savingUnitIds"
            @advance-stage="$emit('advance-stage', $event)"
            @remove-unit="$emit('remove-unit', $event)"
          />

          <!-- 葉ユニット追加ボタン -->
          <div v-if="isEditMode" class="add-leaf-unit">
            <button type="button" class="add-leaf-button"
              @click="$emit('add-child', { parentId: unit.id })"
              title="コマを追加">+ </button>
          </div>
        </div>

        <!-- 子に中間ユニットが含まれる場合：従来のパネル表示 -->
        <div v-else class="children-grid">
          <PanelStyleUnitPanel
            v-for="child in unit.children"
            :key="child.id"
            :unit="child"
            :level="level + 1"
            :stage-count="stageCount"
            :stage-labels="stageLabels"
            :stage-colors="stageColors"
            :is-edit-mode="isEditMode"
            :saving-unit-ids="savingUnitIds"
            @advance-stage="$emit('advance-stage', $event)"
            @add-child="$emit('add-child', $event)"
            @remove-unit="$emit('remove-unit', $event)"
            @update-children-count="$emit('update-children-count', $event)"
          />

          <!-- 子ユニット追加ボタン -->
          <div v-if="isEditMode" class="add-child-panel">
            <button type="button" class="add-child-button"
              @click="$emit('add-child', { parentId: unit.id })">+</button>
          </div>
        </div>
      </div>

      <div v-else-if="isEditMode" class="empty-children">
        <button type="button" class="add-child-button large"
          @click="$emit('add-child', { parentId: unit.id })">+</button>
      </div>

      <div v-else class="empty-children">
        <span class="empty-text">子要素なし</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { WorkUnit } from "@/store/worksStore";
import LeafUnitButton from './LeafUnitButton.vue';

interface Props {
  unit: WorkUnit;
  level: number;
  stageCount: number;
  stageLabels: string[];
  stageColors: string[];
  isEditMode: boolean;
  savingUnitIds: Set<string>;
}

interface Emits {
  (event: "advance-stage", payload: { unitId: string }): void;
  (event: "add-child", payload: { parentId: string }): void;
  (event: "remove-unit", payload: { unitId: string }): void;
  (event: "update-children-count", payload: { unitId: string; count: number }): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// 計算プロパティ
const isLeafUnit = computed(() => props.unit.stageIndex !== undefined);
const hasChildren = computed(() => props.unit.children && props.unit.children.length > 0);
const isSaving = computed(() => props.savingUnitIds.has(props.unit.id));

const panelTypeLabel = computed(() => {
  if (props.level === 0) return "ページ";
  if (isLeafUnit.value) return "コマ";
  return "グループ";
});

const allChildrenAreLeaf = computed(() => {
  if (!hasChildren.value) return false;
  return props.unit.children?.every(child => child.stageIndex !== undefined) || false;
});

// イベントハンドラー

const handleRemove = () => {
  const typeName = panelTypeLabel.value;
  if (confirm(`${typeName} #${props.unit.index}を削除しますか？${hasChildren.value ? '\n\n子要素も一緒に削除されます。' : ''}`)) {
    emit("remove-unit", { unitId: props.unit.id });
  }
};


</script>

<style scoped>
.unit-panel {
  border: 1px solid var(--bs-border-color);
  border-radius: 0.5rem;
  background-color: white;
  transition: all 0.2s ease;
  min-height: 120px;
  display: flex;
  flex-direction: column;
}

.unit-panel:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.is-saving {
  background-color: var(--bs-warning-bg-subtle);
  border-color: var(--bs-warning);
}

/* レベル別の色分け */
.level-0 {
  border-width: 2px;
  border-color: var(--bs-primary);
}

.level-1 {
  border-color: var(--bs-success);
}

.level-2 {
  border-color: var(--bs-info);
}

/* パネルヘッダー */
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  border-bottom: 1px solid var(--bs-border-color);
  background-color: var(--bs-gray-50);
  border-radius: 0.5rem 0.5rem 0 0;
}

.panel-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.panel-index {
  font-weight: bold;
  color: var(--bs-primary);
}

.panel-type {
  font-size: 0.875rem;
  color: var(--bs-gray-600);
}

.panel-actions {
  display: flex;
  gap: 0.25rem;
}

.action-btn {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 50%;
  font-size: 0.875rem;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.add-btn {
  background-color: var(--bs-success);
  color: white;
}

.add-btn:hover {
  background-color: var(--bs-success);
  transform: scale(1.1);
}

.remove-btn {
  background-color: var(--bs-danger);
  color: white;
}

.remove-btn:hover {
  background-color: var(--bs-danger);
  transform: scale(1.1);
}

/* パネルコンテンツ */
.panel-content {
  flex-grow: 1;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
}

.leaf-content {
  align-items: center;
  justify-content: center;
}

.stage-button {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-weight: 500;
  min-width: 100px;
  position: relative;
}

.stage-button:disabled {
  opacity: 0.6;
}

/* 子ユニットグリッド */
.children-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.5rem;
  flex-grow: 1;
}

.add-child-panel {
  border: 1px dashed var(--bs-border-color);
  border-radius: 0.375rem;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 80px;
  background-color: var(--bs-gray-50);
  transition: all 0.2s ease;
}

.add-child-panel:hover {
  border-color: var(--bs-success);
  background-color: var(--bs-success-bg-subtle);
}

.add-child-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--bs-gray-500);
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 0.375rem;
  transition: all 0.2s ease;
}

.add-child-button:hover {
  color: var(--bs-success);
  background-color: var(--bs-success-bg-subtle);
}

.add-child-button.large {
  font-size: 1rem;
  padding: 1rem;
}

.empty-children {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-grow: 1;
  color: var(--bs-gray-500);
  font-style: italic;
}

/* パネルフッター */
.panel-footer {
  padding: 0.5rem;
  border-top: 1px solid var(--bs-border-color);
  background-color: var(--bs-gray-50);
}

.children-count-control {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.children-count-control .form-control {
  width: 80px;
  text-align: center;
}

/* 葉ユニットグリッド */
.leaf-units-grid {
  display: grid;
  gap: 0.125rem;
  padding: 0.25rem;
}

/* 全階層で2列固定表示 */
.unit-panel.level-0 .leaf-units-grid,
.unit-panel.level-1 .leaf-units-grid,
.unit-panel.level-2 .leaf-units-grid,
.unit-panel.level-3 .leaf-units-grid,
.unit-panel.level-4 .leaf-units-grid {
  grid-template-columns: 1fr 1fr !important;
}



.add-leaf-unit {
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-leaf-button {
  background: none;
  border: 2px dashed var(--bs-gray-300);
  color: var(--bs-gray-500);
  cursor: pointer;
  padding: 0.5rem 0.75rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  width: 100%;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-leaf-button:hover {
  color: var(--bs-success);
  border-color: var(--bs-success);
  background-color: var(--bs-success-bg-subtle);
}

/* レスポンシブ調整 */
@media (max-width: 768px) {
  .children-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 0.375rem;
  }

  /* モバイルでも全階層2列固定を維持 */
  .unit-panel.level-0 .leaf-units-grid,
  .unit-panel.level-1 .leaf-units-grid,
  .unit-panel.level-2 .leaf-units-grid,
  .unit-panel.level-3 .leaf-units-grid,
  .unit-panel.level-4 .leaf-units-grid {
    grid-template-columns: 1fr 1fr !important;
  }

  .leaf-units-grid {
    gap: 0.125rem;
    padding: 0.25rem;
  }

  .add-leaf-button {
    font-size: 0.75rem;
    padding: 0.25rem 0.375rem;
  }

  .panel-content {
    padding: 0.5rem;
  }
}

@media (min-width: 1200px) {
  /* 大画面でも全階層2列固定を維持 */
  .unit-panel.level-0 .leaf-units-grid,
  .unit-panel.level-1 .leaf-units-grid,
  .unit-panel.level-2 .leaf-units-grid,
  .unit-panel.level-3 .leaf-units-grid,
  .unit-panel.level-4 .leaf-units-grid {
    grid-template-columns: 1fr 1fr !important;
  }
}

@media (min-width: 1400px) {
  /* 超大画面でも全階層2列固定を維持 */
  .unit-panel.level-0 > .panel-content > .children-container > .leaf-units-grid,
  .unit-panel.level-1 > .panel-content > .children-container > .leaf-units-grid,
  .unit-panel.level-2 > .panel-content > .children-container > .leaf-units-grid,
  .unit-panel.level-3 > .panel-content > .children-container > .leaf-units-grid,
  .unit-panel.level-4 > .panel-content > .children-container > .leaf-units-grid {
    grid-template-columns: 1fr 1fr !important;
  }
}
</style>
