<script setup lang="ts">
// TODO: 設定フォームの状態管理と保存処理を実装

import { computed, ref } from "vue";

import GranularityTable from "./components/GranularityTable.vue";
import StageWorkloadEditor from "./components/StageWorkloadEditor.vue";
import WorkHoursForm from "./components/WorkHoursForm.vue";

interface WorkHoursFormExposed {
  submit: () => void;
  isSaving: () => boolean;
  canSave: () => boolean;
}

interface GranularityTableExposed {
  save: () => void;
  isSaving: () => boolean;
  canSave: () => boolean;
}

interface StageWorkloadEditorExposed {
  save: () => void;
  isSaving: () => boolean;
  canSave: () => boolean;
  resetColors: () => void;
  removeGranularityEntries: (granularityId: string) => void;
}

const workHoursRef = ref<WorkHoursFormExposed | null>(null);
const granularityRef = ref<GranularityTableExposed | null>(null);
const stageEditorRef = ref<StageWorkloadEditorExposed | null>(null);

const workHoursSaving = computed(() => workHoursRef.value?.isSaving() ?? false);
const workHoursCanSave = computed(() => workHoursRef.value?.canSave() ?? false);
const granularitySaving = computed(() => granularityRef.value?.isSaving() ?? false);
const granularityCanSave = computed(() => granularityRef.value?.canSave() ?? false);
const stageSaving = computed(() => stageEditorRef.value?.isSaving() ?? false);
const stageCanSave = computed(() => stageEditorRef.value?.canSave() ?? false);

const saveWorkHours = () => {
  workHoursRef.value?.submit();
};

const saveGranularities = () => {
  granularityRef.value?.save();
};

const saveStageWorkloads = () => {
  stageEditorRef.value?.save();
};

const resetStageColors = () => {
  stageEditorRef.value?.resetColors();
};

const handleGranularityRemoved = (granularityId: string) => {
  // StageWorkloadEditorに粒度削除を通知
  stageEditorRef.value?.removeGranularityEntries(granularityId);
};
</script>

<template>
  <section class="container py-5">
    <div class="mb-4">
      <h1 class="h3 fw-semibold">設定</h1>
      <p class="text-muted">作業時間や粒度、工数設定を管理します。</p>
    </div>

    <div class="row g-3">
      <div class="col-12 col-lg-6">
        <div class="card shadow-sm h-100">
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
              <h2 class="h5 mb-0">作業可能時間の設定</h2>
              <button class="btn btn-primary" type="button" :disabled="workHoursSaving || !workHoursCanSave" @click="saveWorkHours">
                {{ workHoursSaving ? "保存中..." : "設定を保存" }}
              </button>
            </div>
            <WorkHoursForm ref="workHoursRef" />
          </div>
        </div>
      </div>

      <div class="col-12 col-lg-6">
        <div class="card shadow-sm h-100">
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
              <h2 class="h5 mb-0">作業粒度の設定</h2>
              <button class="btn btn-primary" type="button" :disabled="granularitySaving || !granularityCanSave" @click="saveGranularities">
                {{ granularitySaving ? "保存中..." : "変更を保存" }}
              </button>
            </div>
            <GranularityTable ref="granularityRef" @granularity-removed="handleGranularityRemoved" />
          </div>
        </div>
      </div>

      <div class="col-12">
        <div class="card shadow-sm">
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
              <h2 class="h5 mb-0">作業工数の設定</h2>
              <div class="d-flex flex-wrap gap-2">
                <button class="btn btn-outline-secondary" type="button" :disabled="stageSaving" @click="resetStageColors">色を再設定</button>
                <button class="btn btn-primary" type="button" :disabled="stageSaving || !stageCanSave" @click="saveStageWorkloads">
                  {{ stageSaving ? "保存中..." : "設定を保存" }}
                </button>
              </div>
            </div>
            <StageWorkloadEditor ref="stageEditorRef" />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
