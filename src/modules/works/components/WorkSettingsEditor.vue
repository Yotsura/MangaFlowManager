<template>
  <div class="work-settings-editor">
    <h5 class="mb-4">作品固有設定</h5>

    <!-- 粒度設定 -->
    <div class="mb-5">
      <h6 class="mb-3 d-flex justify-content-between align-items-center">
        粒度設定
        <button
          type="button"
          class="btn btn-sm btn-outline-primary"
          @click="addGranularity"
        >
          <i class="bi bi-plus"></i> 追加
        </button>
      </h6>

      <div v-if="localGranularities.length === 0" class="alert alert-info">
        粒度が設定されていません。追加ボタンから粒度を追加してください。
      </div>

      <div v-else class="table-responsive">
        <table class="table table-sm">
          <thead>
            <tr>
              <th>ラベル</th>
              <th>重み</th>
              <th>デフォルト数</th>
              <th width="100">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(granularity, index) in localGranularities" :key="granularity.id">
              <td>
                <input
                  v-model="granularity.label"
                  type="text"
                  class="form-control form-control-sm"
                  @input="notifyGranularityChange"
                />
              </td>
              <td>
                <input
                  v-model.number="granularity.weight"
                  type="number"
                  class="form-control form-control-sm"
                  min="1"
                  @input="notifyGranularityChange"
                  @change="notifyGranularityChange"
                  @blur="notifyGranularityChange"
                />
              </td>
              <td>
                <input
                  v-model.number="granularity.defaultCount"
                  type="number"
                  class="form-control form-control-sm"
                  min="1"
                  @input="notifyGranularityChange"
                  @change="notifyGranularityChange"
                  @blur="notifyGranularityChange"
                />
              </td>
              <td>
                <button
                  type="button"
                  class="btn btn-sm btn-outline-danger"
                  @click="removeGranularity(index)"
                >
                  削除
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ステージ作業負荷設定 -->
    <div class="mb-4">
      <h6 class="mb-3 d-flex justify-content-between align-items-center">
        ステージ作業負荷設定
        <button
          type="button"
          class="btn btn-sm btn-outline-primary"
          @click="addStageWorkload"
        >
          <i class="bi bi-plus"></i> 追加
        </button>
      </h6>

      <div v-if="localStageWorkloads.length === 0" class="alert alert-info">
        ステージが設定されていません。追加ボタンからステージを追加してください。
      </div>

      <div v-else class="table-responsive">
        <table class="table table-sm">
          <thead>
            <tr>
              <th>ラベル</th>
              <th>色</th>
              <th>基準工数</th>
              <th width="100">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(stage, index) in localStageWorkloads" :key="stage.id">
              <td>
                <input
                  v-model="stage.label"
                  type="text"
                  class="form-control form-control-sm"
                  @input="notifyStageWorkloadChange"
                />
              </td>
              <td>
                <input
                  v-model="stage.color"
                  type="color"
                  class="form-control form-control-sm"
                  @input="notifyStageWorkloadChange"
                  @change="notifyStageWorkloadChange"
                />
              </td>
              <td>
                <input
                  v-model.number="stage.baseHours"
                  type="number"
                  class="form-control form-control-sm"
                  min="0"
                  step="0.1"
                  @input="notifyStageWorkloadChange"
                  @change="notifyStageWorkloadChange"
                  @blur="notifyStageWorkloadChange"
                />
              </td>
              <td>
                <button
                  type="button"
                  class="btn btn-sm btn-outline-danger"
                  @click="removeStageWorkload(index)"
                >
                  削除
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="text-muted small mt-4 pt-3 border-top">
      <p class="mb-1">※ 作品固有設定を変更すると、この作品のみの表示・計算に影響します。</p>
      <p class="mb-0">※ 変更内容はリアルタイムで反映されます。</p>
    </div>
  </div>
</template><script setup lang="ts">
import { ref, watch } from 'vue'
import type { WorkGranularity, WorkStageWorkload } from '@/store/worksStore'
import { generateId } from '@/utils/id'

const props = defineProps<{
  granularities: WorkGranularity[]
  stageWorkloads: WorkStageWorkload[]
}>()

const emit = defineEmits<{
  granularityChange: [granularities: WorkGranularity[]]
  stageWorkloadChange: [stageWorkloads: WorkStageWorkload[]]
  save: [data: { granularities: WorkGranularity[], stageWorkloads: WorkStageWorkload[] }]
}>()

// ローカルな状態を維持
const localGranularities = ref<WorkGranularity[]>([...props.granularities])
const localStageWorkloads = ref<WorkStageWorkload[]>([...props.stageWorkloads])

// propsが変更された時にローカル状態を更新
watch(() => props.granularities, (newVal) => {
  localGranularities.value = [...newVal]
}, { deep: true })

watch(() => props.stageWorkloads, (newVal) => {
  localStageWorkloads.value = [...newVal]
}, { deep: true })

// 粒度関連の操作
const addGranularity = () => {
  localGranularities.value.push({
    id: generateId(),
    label: `粒度${localGranularities.value.length + 1}`,
    weight: 1,
    defaultCount: 1
  })
  notifyGranularityChange()
}

const removeGranularity = (index: number) => {
  localGranularities.value.splice(index, 1)
  notifyGranularityChange()
}

const notifyGranularityChange = () => {
  emit('granularityChange', [...localGranularities.value])
}

// ステージ作業負荷関連の操作
const addStageWorkload = () => {
  const stageNumber = localStageWorkloads.value.length + 1
  const colors = ['#007bff', '#28a745', '#ffc107', '#dc3545', '#6f42c1', '#fd7e14']

  localStageWorkloads.value.push({
    id: Date.now(),
    label: `ステージ${stageNumber}`,
    color: colors[(stageNumber - 1) % colors.length] || '#007bff',
    baseHours: 1.0
  })
  notifyStageWorkloadChange()
}

const removeStageWorkload = (index: number) => {
  localStageWorkloads.value.splice(index, 1)
  notifyStageWorkloadChange()
}

const notifyStageWorkloadChange = () => {
  emit('stageWorkloadChange', [...localStageWorkloads.value])
}
</script>

<style scoped>
.work-settings-editor .card {
  border: 1px solid #e9ecef;
}

.work-settings-editor .card-body {
  background-color: #f8f9fa;
}

.form-control-sm {
  font-size: 0.875rem;
}

.input-group-sm .input-group-text {
  font-size: 0.875rem;
}
</style>
