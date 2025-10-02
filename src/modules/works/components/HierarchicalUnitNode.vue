<template>
  <div class="hierarchical-unit-node" :class="{ 'is-leaf': isLeafUnit, 'is-saving': isSaving }">
    <div class="unit-row" :style="{ paddingLeft: `${level * 1.5}rem` }">
      <!-- 展開/折りたたみボタン -->
      <button
        v-if="hasChildren"
        type="button"
        class="btn btn-link btn-sm p-0 me-2 expand-btn"
        @click="$emit('toggle-expand', unit.id)"
        :aria-expanded="isExpanded"
        :aria-label="isExpanded ? '折りたたむ' : '展開する'"
      >
        <i class="bi" :class="isExpanded ? 'bi-chevron-down' : 'bi-chevron-right'"></i>
      </button>
      <div v-else class="expand-spacer me-2"></div>

      <!-- ユニット情報 -->
      <div class="unit-info flex-grow-1">
        <div class="d-flex align-items-center">
          <!-- ユニットタイプアイコン -->
          <i class="bi me-2" :class="unitTypeIcon"></i>

          <!-- ユニット名 -->
          <span class="unit-name me-2">{{ unitDisplayName }}</span>

          <!-- 進捗ボタン（最下位ユニットのみ） -->
          <button
            v-if="isLeafUnit"
            type="button"
            class="btn btn-sm me-2 stage-btn"
            :class="stageButtonClass"
            :style="stageButtonStyle"
            @click="handleAdvanceStage"
            :disabled="!isEditMode || isSaving"
            :title="`現在: ${currentStageLabel} → クリックで次の段階へ`"
          >
            <span v-if="isSaving" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
            {{ currentStageLabel }}
          </button>

          <!-- 子ユニット数表示/編集 -->
          <div v-if="hasChildren" class="children-count me-2">
            <template v-if="isEditMode">
              <div class="input-group input-group-sm" style="width: 120px">
                <input type="number" class="form-control" :value="unit.children?.length || 0" min="0" max="999" @change="handleChildrenCountChange" />
                <span class="input-group-text">個</span>
              </div>
            </template>
            <template v-else>
              <span class="badge bg-secondary">{{ unit.children?.length || 0 }}個</span>
            </template>
          </div>
        </div>
      </div>

      <!-- 操作ボタン -->
      <div v-if="isEditMode" class="unit-actions">
        <div class="btn-group btn-group-sm" role="group">
          <button v-if="!isLeafUnit" type="button" class="btn btn-outline-success" @click="$emit('add-child', { parentId: unit.id })" title="子要素を追加">
            <i class="bi bi-plus-lg"></i>
          </button>
          <button type="button" class="btn btn-outline-danger" @click="handleRemove" title="この要素を削除">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- 子ユニット -->
    <div v-if="hasChildren && isExpanded" class="children-container">
      <HierarchicalUnitNode
        v-for="child in unit.children"
        :key="child.id"
        :unit="child"
        :level="level + 1"
        :stage-count="stageCount"
        :stage-labels="stageLabels"
        :stage-colors="stageColors"
        :is-edit-mode="isEditMode"
        :expanded-nodes="expandedNodes"
        :saving-unit-ids="savingUnitIds"
        @toggle-expand="$emit('toggle-expand', $event)"
        @advance-stage="$emit('advance-stage', $event)"
        @add-child="$emit('add-child', $event)"
        @remove-unit="$emit('remove-unit', $event)"
        @update-children-count="$emit('update-children-count', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { stageColorFor } from "@/modules/works/utils/stageColor";
import type { WorkUnit } from "@/store/worksStore";

interface Props {
  unit: WorkUnit;
  level: number;
  stageCount: number;
  stageLabels: string[];
  stageColors: string[];
  isEditMode: boolean;
  expandedNodes: Set<string>;
  savingUnitIds: Set<string>;
}

interface Emits {
  (event: "toggle-expand", unitId: string): void;
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
const isExpanded = computed(() => props.expandedNodes.has(props.unit.id));
const isSaving = computed(() => props.savingUnitIds.has(props.unit.id));

const unitTypeIcon = computed(() => {
  if (isLeafUnit.value) {
    return "bi-file-earmark";
  } else if (hasChildren.value) {
    return isExpanded.value ? "bi-folder2-open" : "bi-folder2";
  } else {
    return "bi-folder";
  }
});

const unitDisplayName = computed(() => {
  if (isLeafUnit.value) {
    return `要素 #${props.unit.index}`;
  } else {
    return `グループ #${props.unit.index}`;
  }
});

const currentStageLabel = computed(() => {
  if (!isLeafUnit.value) return "";
  const stageIndex = props.unit.stageIndex || 0;
  return props.stageLabels[stageIndex] || `段階${stageIndex + 1}`;
});

const stageButtonClass = computed(() => {
  if (!isLeafUnit.value) return "";
  const stageIndex = props.unit.stageIndex || 0;

  // ステージに応じてBootstrapクラスを決定
  if (stageIndex === 0) return "btn-outline-secondary";
  if (stageIndex === props.stageCount - 1) return "btn-success";
  return "btn-primary";
});

const stageButtonStyle = computed(() => {
  if (!isLeafUnit.value) return {};
  const stageIndex = props.unit.stageIndex || 0;
  const override = props.stageColors?.[stageIndex];

  if (override) {
    const { backgroundColor, textColor } = stageColorFor(stageIndex, props.stageCount, override);
    return {
      backgroundColor,
      borderColor: backgroundColor,
      color: textColor,
    };
  }

  return {};
});

// イベントハンドラー
const handleAdvanceStage = () => {
  if (!isLeafUnit.value || !props.isEditMode || isSaving.value) return;
  emit("advance-stage", { unitId: props.unit.id });
};

const handleRemove = () => {
  if (confirm(`${unitDisplayName.value}を削除しますか？${hasChildren.value ? "\n\n子要素も一緒に削除されます。" : ""}`)) {
    emit("remove-unit", { unitId: props.unit.id });
  }
};

const handleChildrenCountChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const count = parseInt(target.value, 10);
  if (isNaN(count) || count < 0) return;

  emit("update-children-count", { unitId: props.unit.id, count });
};
</script>

<style scoped>
.hierarchical-unit-node {
  position: relative;
}

.unit-row {
  display: flex;
  align-items: center;
  padding: 0.5rem 0;
  border-radius: 0.25rem;
  transition: background-color 0.15s ease-in-out;
}

.unit-row:hover {
  background-color: var(--bs-gray-100);
}

.is-saving .unit-row {
  background-color: var(--bs-warning-bg-subtle);
}

.expand-btn {
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--bs-gray-600);
  text-decoration: none;
}

.expand-btn:hover {
  color: var(--bs-primary);
}

.expand-spacer {
  width: 1.5rem;
  height: 1.5rem;
}

.unit-info {
  min-width: 0; /* flexboxでの収縮を許可 */
}

.unit-name {
  font-weight: 500;
  color: var(--bs-gray-800);
}

.stage-btn {
  min-width: 80px;
  font-size: 0.875rem;
  position: relative;
}

.stage-btn:disabled {
  opacity: 0.6;
}

.children-count .input-group-sm .form-control {
  font-size: 0.875rem;
}

.unit-actions {
  margin-left: auto;
  flex-shrink: 0;
}

.children-container {
  position: relative;
}

.children-container::before {
  content: "";
  position: absolute;
  left: 0.75rem;
  top: 0;
  bottom: 0;
  width: 1px;
  background-color: var(--bs-border-color);
  opacity: 0.5;
}

/* レベルごとの色分け */
.hierarchical-unit-node[data-level="0"] .unit-row:hover {
  background-color: var(--bs-primary-bg-subtle);
}

.hierarchical-unit-node[data-level="1"] .unit-row:hover {
  background-color: var(--bs-success-bg-subtle);
}

.hierarchical-unit-node[data-level="2"] .unit-row:hover {
  background-color: var(--bs-info-bg-subtle);
}
</style>
