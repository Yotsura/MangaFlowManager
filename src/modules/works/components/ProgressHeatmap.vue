<script setup lang="ts">
import { computed } from "vue";
import type { WorkUnit } from "@/store/worksStore";

const props = defineProps<{
  units: WorkUnit[];
  stageCount: number;
  stageLabels: string[];
  stageColors?: string[];
  stageWorkloadHours?: number[]; // 各工程の工数（時間）
}>();

// 最下位レベルのユニット（stageIndexを持つもの）を再帰的に収集
const collectLeafUnits = (units: WorkUnit[]): WorkUnit[] => {
  const result: WorkUnit[] = [];
  for (const unit of units) {
    if (unit.stageIndex !== undefined) {
      result.push(unit);
    } else if (unit.children) {
      result.push(...collectLeafUnits(unit.children));
    }
  }
  return result;
};

const leafUnits = computed(() => collectLeafUnits(props.units));

// 各工程の進捗を計算
const stageProgress = computed(() => {
  if (leafUnits.value.length === 0) {
    return [];
  }

  const totalUnits = leafUnits.value.length;

  return props.stageLabels.map((label, stageIndex) => {
    // 該当工程まで完了したユニット数を計算
    // stageLabels[stageIndex]の工程の進捗 = その工程まで完了したユニット数
    // 例: "ネーム済"工程(index:0)なら stageIndex >= 1 のユニット数（1つずらし）
    const completedUnits = leafUnits.value.filter(unit => (unit.stageIndex ?? 0) >= stageIndex).length;
    const progressPercentage = Math.round((completedUnits / totalUnits) * 100);

    // デバッグログ
    console.log(`Stage ${stageIndex} "${label}": ${completedUnits}/${totalUnits} = ${progressPercentage}%`);
    console.log(`Units with stageIndex >= ${stageIndex + 1}:`, leafUnits.value.filter(unit => (unit.stageIndex ?? 0) >= stageIndex + 1).map(u => `Unit${u.index}(stage:${u.stageIndex})`));

    return {
      label,
      hours: props.stageWorkloadHours?.[stageIndex] ?? 0,
      progressPercentage,
      color: props.stageColors?.[stageIndex] ?? '#6c757d'
    };
  });
});

// 背景色に対して適切なテキスト色を返す関数
const getContrastColor = (backgroundColor: string) => {
  // カラーコードから RGB 値を抽出
  const hex = backgroundColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // 明度を計算 (0-255)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;

  // 明度が128より大きい場合は黒、そうでなければ白
  return brightness > 128 ? '#000000' : '#ffffff';
};
</script>

<template>
  <div class="progress-wrapper" role="region" aria-label="工程別進捗表示">
    <template v-if="stageProgress.length">
      <div v-for="stage in stageProgress" :key="stage.label" class="stage-progress-row">
        <div
          class="stage-label-badge"
          :style="{
            backgroundColor: stage.color,
            color: getContrastColor(stage.color)
          }"
        >
          {{ stage.label }}（{{ stage.hours }}h）
        </div>
        <div class="progress-bar-container">
          <div
            class="progress-bar"
            :style="{
              width: stage.progressPercentage + '%'
            }"
          >
            <span v-if="stage.progressPercentage > 15" class="progress-text">{{ stage.progressPercentage }}%</span>
          </div>
          <span class="progress-percentage-overlay">{{ stage.progressPercentage }}%</span>
        </div>
      </div>
    </template>
    <p v-else class="text-muted mb-0">工程データがありません。</p>
  </div>
</template>

<style scoped>
.progress-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.stage-progress-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.stage-label-badge {
  min-width: 140px;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.85rem;
  font-weight: 600;
  text-align: center;
  white-space: nowrap;
  flex-shrink: 0;
}

.progress-bar-container {
  position: relative;
  flex: 1;
  height: 1.75rem;
  background-color: #e9ecef;
  border-radius: 0.875rem;
  overflow: hidden;
}

.progress-bar {
  position: relative;
  height: 100%;
  background-color: #198754; /* Bootstrap success color */
  border-radius: 0.875rem;
  transition: width 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.progress-text {
  font-size: 0.75rem;
  font-weight: 600;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.progress-percentage-overlay {
  position: absolute;
  top: 50%;
  right: 0.5rem;
  transform: translateY(-50%);
  font-size: 0.75rem;
  font-weight: 600;
  color: #495057;
  z-index: 1;
}

/* レスポンシブ対応 */
@media (max-width: 768px) {
  .stage-label-badge {
    min-width: 120px;
    font-size: 0.8rem;
    padding: 0.4rem 0.6rem;
  }

  .progress-bar-container {
    height: 1.5rem;
  }

  .progress-text,
  .progress-percentage-overlay {
    font-size: 0.7rem;
  }
}

@media (max-width: 576px) {
  .stage-progress-row {
    flex-direction: column;
    gap: 0.5rem;
  }

  .stage-label-badge {
    min-width: auto;
    width: 100%;
  }

  .progress-bar-container {
    width: 100%;
  }
}
</style>
