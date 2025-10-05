<template>
  <button
    type="button"
    class="leaf-unit-button"
    :class="[stageButtonClass, { 'edit-mode': isEditMode, 'normal-mode': !isEditMode }]"
    :style="stageButtonStyle"
    @click="handleButtonClick"
    :disabled="isSaving"
    :title="buttonTitle"
  >
    <span v-if="isSaving" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
    #{{ unit.index }} {{ currentStageLabel }}

    <!-- 編集モード時の削除アイコン -->
    <span v-if="isEditMode" class="delete-icon">×</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { stageColorFor } from "@/modules/works/utils/stageColor";
import type { WorkUnit } from "@/store/worksStore";

interface Props {
  unit: WorkUnit;
  stageCount: number;
  stageLabels: string[];
  stageColors: string[];
  isEditMode: boolean;
  savingUnitIds: Set<string>;
}

interface Emits {
  (event: "advance-stage", payload: { unitId: string }): void;
  (event: "remove-unit", payload: { unitId: string }): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// 計算プロパティ
const isSaving = computed(() => props.savingUnitIds.has(props.unit.id));

const currentStageLabel = computed(() => {
  const stageIndex = props.unit.stageIndex || 0;
  return props.stageLabels[stageIndex] || `段階${stageIndex + 1}`;
});

const stageButtonClass = computed(() => {
  const stageIndex = props.unit.stageIndex || 0;

  if (stageIndex === 0) return "btn-outline-secondary";
  if (stageIndex === props.stageCount - 1) return "btn-success";
  return "btn-primary";
});

const stageButtonStyle = computed(() => {
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

// ボタンのタイトルテキスト
const buttonTitle = computed(() => {
  if (props.isEditMode) {
    return `#${props.unit.index} ${currentStageLabel.value} - クリックで削除`;
  } else {
    return `#${props.unit.index} 現在: ${currentStageLabel.value} → クリックで次の段階へ`;
  }
});

// メインボタンのクリックハンドラー
const handleButtonClick = () => {
  if (isSaving.value) return;

  if (props.isEditMode) {
    // 編集モード：削除
    handleRemove();
  } else {
    // 通常モード：段階進行
    handleAdvanceStage();
  }
};

// 段階進行ハンドラー
const handleAdvanceStage = () => {
  emit("advance-stage", { unitId: props.unit.id });
};

// 削除ハンドラー
const handleRemove = () => {
  emit("remove-unit", { unitId: props.unit.id });
};
</script>

<style scoped>
.leaf-unit-button {
  position: relative;
  padding: 0.25rem 0.5rem;
  margin: 0;
  border-radius: 0.25rem;
  font-weight: 500;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  font-size: 0.875rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.leaf-unit-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.leaf-unit-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.remove-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 50%;
  background-color: var(--bs-danger);
  color: white;
  font-size: 0.75rem;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 1;
}

.remove-btn:hover {
  background-color: var(--bs-danger);
  transform: scale(1.1);
}

/* 保存中スタイル */
.leaf-unit-button:has(.spinner-border) {
  background-color: var(--bs-warning-bg-subtle) !important;
  border-color: var(--bs-warning) !important;
}

/* レスポンシブ調整 */
@media (max-width: 768px) {
  .leaf-unit-button {
    padding: 0.125rem 0.25rem;
    font-size: 0.75rem;
  }

  .remove-btn {
    width: 14px;
    height: 14px;
    font-size: 0.625rem;
    top: 1px;
    right: 1px;
  }
}

@media (min-width: 1200px) {
  .leaf-unit-button {
    padding: 0.375rem 0.625rem;
    font-size: 1rem;
  }
}
</style>
