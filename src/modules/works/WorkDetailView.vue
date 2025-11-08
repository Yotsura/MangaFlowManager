<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useRoute, useRouter, onBeforeRouteLeave } from "vue-router";
import WorkloadSettingsEditor from "@/components/common/WorkloadSettingsEditor.vue";
import EditModal from "@/components/common/EditModal.vue";
import WorkSummaryCard from "./components/WorkSummaryCard.vue";
import WorkStageSettingsCard from "./components/WorkStageSettingsCard.vue";
import WorkStructureCard from "./components/WorkStructureCard.vue";
import WorkActionButtons from "./components/WorkActionButtons.vue";

import { useAuthStore } from "@/store/authStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useCustomDatesStore } from "@/store/customDatesStore";
import { WORK_STATUSES, useWorksStore, type WorkStatus, type WorkGranularity, type WorkStageWorkload } from "@/store/worksStore";
import {
  parseStructureString,
  validateStructureString,
  convertToWorkStructure,
  convertWorkUnitsToStructureString
} from "@/utils/structureParser";

const route = useRoute();
const router = useRouter();
const workId = route.params.id as string;

const authStore = useAuthStore();
const settingsStore = useSettingsStore();
const worksStore = useWorksStore();
const customDatesStore = useCustomDatesStore();

const { user } = storeToRefs(authStore);
const { granularities, granularitiesLoaded, loadingGranularities, stageWorkloads, stageWorkloadsLoaded, loadingStageWorkloads } = storeToRefs(settingsStore);

const work = computed(() => worksStore.getWorkById(workId));

// 元の設定を取得する計算プロパティ
const originalWorkGranularities = computed(() => {
  // 作品固有の設定があればそれを使用、なければ全体設定を使用
  if (work.value?.workGranularities && work.value.workGranularities.length > 0) {
    return work.value.workGranularities;
  }
  return granularities.value;
});

const originalWorkStageWorkloads = computed(() => {
  // 作品固有の設定があればそれを使用、なければ全体設定を使用
  if (work.value?.workStageWorkloads && work.value.workStageWorkloads.length > 0) {
    return work.value.workStageWorkloads;
  }
  return stageWorkloads.value;
});

// リアルタイム表示用（ローカル変更または元の設定）
const workGranularities = computed(() => hasUnsavedSettings.value ? localWorkGranularities.value : originalWorkGranularities.value);
const workStageWorkloads = computed(() => hasUnsavedSettings.value ? localWorkStageWorkloads.value : originalWorkStageWorkloads.value);

// 作品固有設定に基づく派生データ
const stageLabels = computed(() => workStageWorkloads.value.map((stage) => stage.label));
const stageCount = computed(() => stageLabels.value.length);

// 重みでソートした粒度配列（高い重み→低い重み）
const sortedGranularities = computed(() => {
  return [...workGranularities.value].sort((a, b) => b.weight - a.weight);
});

const userId = computed(() => user.value?.uid ?? null);

const isSavingWork = computed(() => (work.value ? worksStore.isSavingWork(work.value.id) : false));
const canSaveWork = computed(() => (work.value ? worksStore.isWorkDirty(work.value.id) : false));
const saveErrorMessage = computed(() => (work.value ? worksStore.getSaveError(work.value.id) : null));

// 現在の構造を文字列として表示
const currentStructureString = computed(() => {
  if (!work.value || !work.value.units || work.value.units.length === 0) {
    return "構造が設定されていません";
  }

  const granularityCount = sortedGranularities.value.length;
  return convertWorkUnitsToStructureString(work.value.units, granularityCount);
});const lastSaveStatus = ref<string | null>(null);
const isEditMode = ref(false);
const savingPanelIds = ref(new Set<string>());

// 作品構造編集用の状態
const isStructureEditMode = ref(false);
const structureEditForm = reactive({
  structureString: "",
});
const structureEditError = ref<string | null>(null);
const isSavingStructure = ref(false);

// リアルタイム更新用のローカル設定状態
const localWorkGranularities = ref<WorkGranularity[]>([]);
const localWorkStageWorkloads = ref<WorkStageWorkload[]>([]);
const hasUnsavedSettings = ref(false);
const isSavingSettings = ref(false);
const isSettingsEditMode = ref(false);

// ローカル設定の初期化
const initializeLocalSettings = () => {
  localWorkGranularities.value = [...originalWorkGranularities.value];
  localWorkStageWorkloads.value = [...originalWorkStageWorkloads.value];
  hasUnsavedSettings.value = false;
};

// 設定変更のハンドラー（リアルタイム適用）
const handleGranularityChange = (newGranularities: WorkGranularity[]) => {
  localWorkGranularities.value = [...newGranularities];

  // 編集モードでのみ未保存フラグを設定
  if (isSettingsEditMode.value) {
    hasUnsavedSettings.value = true;
  }
};

const handleStageWorkloadChange = (newStageWorkloads: WorkStageWorkload[]) => {
  localWorkStageWorkloads.value = [...newStageWorkloads];

  // 編集モードでのみ未保存フラグを設定
  if (isSettingsEditMode.value) {
    hasUnsavedSettings.value = true;
  }
};

const handleBulkStageUpdate = async (updates: Array<{ unitId: string; newStage: number }>) => {
  if (!work.value || updates.length === 0) return;

  try {
    // 各作業単位の段階を更新
    for (const update of updates) {
      worksStore.updateUnitStage(work.value.id, update.unitId, update.newStage);
    }

    // サーバーに保存
    if (userId.value) {
      await worksStore.saveWork({
        userId: userId.value,
        workId: work.value.id
      });
    }

    // 成功メッセージを表示
    console.log(`${updates.length}個の作業単位の段階を更新し、サーバーに保存しました`);
  } catch (error) {
    console.error('一括段階更新エラー:', error);
    alert('一括段階更新に失敗しました。もう一度お試しください。');
  }
};// 設定編集モードの変更を監視
watch(isSettingsEditMode, (newValue) => {
  if (!newValue) {
    // 編集モードを出る際は未保存フラグをリセット
    hasUnsavedSettings.value = false;
  }
});

// 設定の保存
const saveSettings = async () => {
  if (!work.value || !userId.value || isSavingSettings.value) return;

  isSavingSettings.value = true;

  try {
    // worksStoreのupdateWorkメソッドを使用して設定を更新
    worksStore.updateWork(workId, {
      workGranularities: [...localWorkGranularities.value],
      workStageWorkloads: [...localWorkStageWorkloads.value]
    });

    // サーバーに保存
    await worksStore.saveWork({ userId: userId.value, workId });

    hasUnsavedSettings.value = false;
    isSettingsEditMode.value = false;
    lastSaveStatus.value = "作品設定を保存しました";
    setTimeout(() => {
      lastSaveStatus.value = null;
    }, 3000);
  } catch (error) {
    console.error("設定の保存に失敗:", error);
    lastSaveStatus.value = "設定の保存に失敗しました";
    setTimeout(() => {
      lastSaveStatus.value = null;
    }, 5000);
  } finally {
    isSavingSettings.value = false;
  }
};

// 設定の変更を破棄
const discardSettings = () => {
  initializeLocalSettings();
  isSettingsEditMode.value = false;
};

// 設定編集モードの切り替え
const toggleSettingsEditMode = () => {
  isSettingsEditMode.value = !isSettingsEditMode.value;

  if (isSettingsEditMode.value) {
    // 編集モードに入る際はローカル設定を初期化
    initializeLocalSettings();
  } else {
    // 編集モードを出る際は変更を破棄
    discardSettings();
  }
};

const toggleEditMode = async () => {
  isEditMode.value = !isEditMode.value;

  // 編集モードを出る際に未保存の変更を破棄
  if (!isEditMode.value && work.value && canSaveWork.value) {
    worksStore.discardWorkChanges(work.value.id);

    // 作品データを再読み込みして全ての変更を破棄
    await reloadWorkData();
  }
};

// 作品構造編集機能
const toggleStructureEditMode = () => {
  isStructureEditMode.value = !isStructureEditMode.value;

  if (isStructureEditMode.value) {
    // 編集モード開始時に現在の構造文字列を自動入力
    structureEditForm.structureString = currentStructureString.value === '構造が設定されていません'
      ? ''
      : currentStructureString.value;
    structureEditError.value = null;
  }
};

const validateStructureInput = () => {
  const structureStr = structureEditForm.structureString.trim();
  if (!structureStr) {
    structureEditError.value = "構造文字列を入力してください。";
    return false;
  }

  const granularityCount = sortedGranularities.value.length;
  const basicError = validateStructureString(structureStr, granularityCount);
  if (basicError) {
    structureEditError.value = basicError;
    return false;
  }

  structureEditError.value = null;
  return true;
};

const applyStructureChanges = async () => {
  if (!work.value || !validateStructureInput()) {
    return;
  }

  try {
    isSavingStructure.value = true;

    const granularityCount = sortedGranularities.value.length;
    const parsed = parseStructureString(structureEditForm.structureString, granularityCount);
    if (!parsed) {
      structureEditError.value = "構造文字列の解析に失敗しました。階層数が粒度設定と一致しているか確認してください。";
      return;
    }

    const workStructure = convertToWorkStructure(parsed);

    // worksStoreの構造上書き機能を使用
    const success = worksStore.overwriteWorkStructure(work.value.id, {
      topLevelUnits: workStructure.structureData,
      hierarchicalUnits: workStructure.hierarchicalStructureData
    });

    if (success) {
      console.log('作品構造が正常に更新されました');

      // Firestoreに保存
      await worksStore.saveWork({
        userId: user.value.uid,
        workId: work.value.id
      });

      isStructureEditMode.value = false;
      structureEditForm.structureString = "";

      // 作品データを再読み込み
      await reloadWorkData();
    } else {
      structureEditError.value = "構造の更新に失敗しました。";
    }
  } catch (error) {
    console.error('作品構造更新エラー:', error);
    structureEditError.value = "構造の更新中にエラーが発生しました。";
  } finally {
    isSavingStructure.value = false;
  }
};

watch(
  canSaveWork,
  (pending) => {
    if (pending) {
      lastSaveStatus.value = null;
    }
  },
  { immediate: false },
);

watch(
  saveErrorMessage,
  (message) => {
    if (message) {
      lastSaveStatus.value = null;
    }
  },
  { immediate: false },
);

// 元の設定が変更されたらローカル設定を初期化
watch(
  [originalWorkGranularities, originalWorkStageWorkloads],
  () => {
    if (!hasUnsavedSettings.value) {
      initializeLocalSettings();
    }
  },
  { immediate: true },
);

const ensureSettingsLoaded = async () => {
  if (!userId.value) {
    return;
  }

  if (!granularitiesLoaded.value && !loadingGranularities.value) {
    await settingsStore.fetchGranularities(userId.value);
  }

  if (!stageWorkloadsLoaded.value && !loadingStageWorkloads.value) {
    await settingsStore.fetchStageWorkloads(userId.value);
  }

  // 作業時間設定も読み込む
  if (!settingsStore.workHoursLoaded && !settingsStore.loadingWorkHours) {
    await settingsStore.fetchWorkHours(userId.value);
  }

  // カスタム日付設定も読み込む
  if (!customDatesStore.customDatesLoaded && !customDatesStore.loadingCustomDates) {
    await customDatesStore.fetchCustomDates(userId.value);
  }
};

const ensureWorksLoaded = async () => {
  if (!userId.value) {
    return;
  }

  if (!worksStore.worksLoaded && !worksStore.loadingWorks) {
    await worksStore.fetchWorks(userId.value);
  }
};

// 作品データの再読込処理
const reloadWorkData = async () => {
  if (!userId.value || !workId) {
    return;
  }

  // 特定の作品データを再読込
  await worksStore.fetchWorkById(userId.value, workId);
};

// ページ遷移時の未保存変更破棄処理
onBeforeRouteLeave(() => {
  if (work.value && canSaveWork.value) {
    // 未保存の変更を破棄
    worksStore.discardWorkChanges(work.value.id);
  }
});

onMounted(async () => {
  await authStore.ensureInitialized();
  await ensureSettingsLoaded();
  await ensureWorksLoaded();

  // カスタム日付も読み込む
  if (userId.value && !customDatesStore.customDatesLoaded) {
    await customDatesStore.fetchCustomDates(userId.value);
  }

  // ローカル設定を初期化
  initializeLocalSettings();

  // 作品詳細画面を開く際は常にサーバーから最新データを取得
  await reloadWorkData();
});

watch(userId, async (next, prev) => {
  if (next && next !== prev) {
    await ensureSettingsLoaded();
    await worksStore.fetchWorks(next);
  }
});

const detailForm = reactive({
  title: "",
  status: WORK_STATUSES[0] as WorkStatus,
  startDate: "",
  deadline: "",
});

// 作品固有設定の編集用フォーム
const settingsForm = reactive({
  workGranularities: [] as typeof workGranularities.value,
  workStageWorkloads: [] as typeof workStageWorkloads.value,
});

watch(
  work,
  (next) => {
    if (!next) {
      return;
    }
    detailForm.title = next.title;
    detailForm.status = next.status;
    detailForm.startDate = next.startDate;
    detailForm.deadline = next.deadline;
    lastSaveStatus.value = null;

    // 設定フォームを初期化
    settingsForm.workGranularities = workGranularities.value.slice();
    settingsForm.workStageWorkloads = workStageWorkloads.value.map(stage => {
      const entries = 'entries' in stage && Array.isArray(stage.entries) ? stage.entries.slice() : [];
      return {
        ...stage,
        entries
      };
    });

    // 作品固有設定がない場合は現在の全体設定をコピー
    if ((!next.workGranularities || next.workGranularities.length === 0) &&
        (!next.workStageWorkloads || next.workStageWorkloads.length === 0)) {
      worksStore.migrateWorkSettings({
        workId: next.id,
        granularities: granularities.value,
        stageWorkloads: stageWorkloads.value
      });
    }
  },
  { immediate: true },
);

watch(
  () => detailForm.title,
  (value) => {
    if (isEditMode.value && work.value && value !== work.value.title) {
      worksStore.updateWork(work.value.id, { title: value });
    }
  },
);

watch(
  () => detailForm.status,
  (value) => {
    if (isEditMode.value && work.value && value !== work.value.status) {
      worksStore.updateWork(work.value.id, { status: value });
    }
  },
);

watch(
  () => detailForm.startDate,
  (value) => {
    if (isEditMode.value && work.value && value !== work.value.startDate) {
      worksStore.updateWork(work.value.id, { startDate: value });
    }
  },
);

watch(
  () => detailForm.deadline,
  (value) => {
    if (isEditMode.value && work.value && value !== work.value.deadline) {
      worksStore.updateWork(work.value.id, { deadline: value });
    }
  },
);

// 新しい階層ユニット操作のイベントハンドラー
const handleAdvanceUnitStage = async (payload: { unitId: string }) => {
  if (!userId.value) {
    return;
  }

  // 保存中状態を追加
  savingPanelIds.value.add(payload.unitId);

  try {
    // ユニットの段階を進める
    worksStore.advanceUnitStage(workId, payload.unitId, stageCount.value);

    // 即座に保存
    await worksStore.saveWork({ userId: userId.value, workId });

    // 成功時のフィードバック
    lastSaveStatus.value = `ユニット ${payload.unitId} の進捗を保存しました`;
    setTimeout(() => {
      lastSaveStatus.value = null;
    }, 3000);
  } catch (error) {
    console.error("ユニット進捗の保存に失敗:", error);
    lastSaveStatus.value = "進捗の保存に失敗しました";
    setTimeout(() => {
      lastSaveStatus.value = null;
    }, 5000);
  } finally {
    // 保存中状態を削除
    savingPanelIds.value.delete(payload.unitId);
  }
};

const handleAddRootUnit = () => {
  // 未保存の設定がある場合は先に保存するか警告
  if (hasUnsavedSettings.value) {
    const confirmed = window.confirm('未保存の設定があります。先に設定を保存してから構造を追加しますか？');
    if (confirmed) {
      saveSettings().then(() => {
        worksStore.addRootUnit(workId);
      });
      return;
    }
  }

  worksStore.addRootUnit(workId);
};

const handleAddChildUnit = (payload: { parentId: string }) => {
  // 未保存の設定がある場合は先に保存するか警告
  if (hasUnsavedSettings.value) {
    const confirmed = window.confirm('未保存の設定があります。先に設定を保存してから構造を追加しますか？');
    if (confirmed) {
      saveSettings().then(() => {
        worksStore.addChildUnit(workId, payload.parentId);
      });
      return;
    }
  }

  worksStore.addChildUnit(workId, payload.parentId);
};const handleRemoveUnit = (payload: { unitId: string }) => {
  worksStore.removeUnit(workId, payload.unitId);
};

const handleUpdateChildrenCount = (payload: { unitId: string; count: number }) => {
  worksStore.setUnitChildrenCount(workId, payload.unitId, payload.count);
};

const requestWorkDeletion = () => {
  if (!work.value) {
    return;
  }

  const confirmed = window.confirm(`作品「${work.value.title || "無題"}」を本当に削除しますか？`);
  if (!confirmed) {
    return;
  }
  if (!userId.value) {
    window.alert("ユーザー情報が取得できませんでした。再度ログインしてください。");
    return;
  }

  worksStore
    .removeWork({ userId: userId.value, workId: work.value.id })
    .then(() => {
      router.push({ name: "works" });
    })
    .catch((error) => {
      console.error(error);
      window.alert("作品の削除に失敗しました。");
    });
};

const handleSave = async () => {
  if (!work.value) {
    return;
  }

  if (!userId.value) {
    window.alert("ユーザー情報が取得できませんでした。再度ログインしてください。");
    return;
  }

  lastSaveStatus.value = null;

  try {
    // 作品固有設定を更新
    worksStore.updateWork(work.value.id, {
      workGranularities: settingsForm.workGranularities,
      workStageWorkloads: settingsForm.workStageWorkloads
    });

    await worksStore.saveWork({ userId: userId.value, workId: work.value.id });
    lastSaveStatus.value = "保存しました";

    // 3秒後にメッセージを消す
    setTimeout(() => {
      lastSaveStatus.value = null;
    }, 3000);

    // 保存成功後に編集モードを閉じる
    isEditMode.value = false;
  } catch (error) {
    console.error(error);
    lastSaveStatus.value = null;
  }
};

const goBackToList = () => {
  router.push({ name: "works" });
};

</script>

<template>
  <section class="container py-3">
    <div v-if="!work" class="alert alert-warning" role="alert">
      指定された作品が見つかりませんでした。
      <button type="button" class="btn btn-link px-1" @click="goBackToList">作品一覧に戻る</button>
    </div>

    <template v-else>
      <div class="row g-4 mb-4">
        <!-- 作品概要情報 -->
        <div class="col-12 col-lg-6">
          <WorkSummaryCard
            :work-id="work.id"
            :title="detailForm.title"
            :status="detailForm.status"
            :start-date="detailForm.startDate"
            :deadline="detailForm.deadline"
            :is-edit-mode="isEditMode"
            :last-save-status="lastSaveStatus"
            :save-error-message="saveErrorMessage"
            @update:title="detailForm.title = $event"
            @update:status="detailForm.status = $event"
            @update:start-date="detailForm.startDate = $event"
            @update:deadline="detailForm.deadline = $event"
            @delete-work="requestWorkDeletion"
          />
        </div>

        <!-- 工程設定 -->
        <div class="col-12 col-lg-6">
          <WorkStageSettingsCard
            :work-id="work.id"
            @open-settings-modal="toggleSettingsEditMode"
          />
        </div>
      </div>

      <div class="row g-4 mb-4">
        <div class="col-12">
          <WorkStructureCard
            :work-id="work.id"
            :is-edit-mode="isEditMode"
            :saving-unit-ids="savingPanelIds"
            @advance-stage="handleAdvanceUnitStage"
            @add-root-unit="handleAddRootUnit"
            @add-child="handleAddChildUnit"
            @remove-unit="handleRemoveUnit"
            @update-children-count="handleUpdateChildrenCount"
            @open-structure-modal="toggleStructureEditMode"
          />
        </div>
      </div>

      <!-- 固定アクションボタン（画面右下） -->
      <WorkActionButtons
        :is-edit-mode="isEditMode"
        :can-save="canSaveWork"
        :is-saving="isSavingWork"
        @toggle-edit-mode="toggleEditMode"
        @cancel="toggleEditMode"
        @save="handleSave"
      />

      <!-- 工程設定編集モーダル -->
      <EditModal
        :show="isSettingsEditMode"
        title="工程設定を編集"
        size="xl"
        :can-save="hasUnsavedSettings"
        :is-saving="isSavingSettings"
        @close="toggleSettingsEditMode"
        @save="saveSettings"
      >
        <WorkloadSettingsEditor
          work-mode
          :work-granularities="localWorkGranularities"
          :work-stage-workloads="localWorkStageWorkloads"
          :work-data="work"
          @granularity-change="handleGranularityChange"
          @stage-workload-change="handleStageWorkloadChange"
          @bulk-stage-update="handleBulkStageUpdate"
        />
      </EditModal>

      <!-- 構造文字列編集モーダル -->
      <EditModal
        :show="isStructureEditMode"
        title="構造指定文字列で一括編集"
        size="lg"
        :can-save="!!structureEditForm.structureString.trim()"
        :is-saving="isSavingStructure"
        @close="toggleStructureEditMode"
        @save="applyStructureChanges"
      >
        <div class="mb-3">
          <label for="structure-input" class="form-label">構造指定文字列</label>
          <textarea
            id="structure-input"
            v-model="structureEditForm.structureString"
            class="form-control"
            :class="{ 'is-invalid': structureEditError }"
            rows="8"
            placeholder="例: [1],[5/5/5/5/5],[5/5/5/4]"
          ></textarea>
          <div v-if="structureEditError" class="invalid-feedback">
            {{ structureEditError }}
          </div>
          <div class="form-text mt-2">
            <strong>書式:</strong><br>
            • 最上位ユニット：カンマ(,)区切りで分割<br>
            • 各最上位ユニット：角括弧[]で囲む<br>
            • 作業段階：スラッシュ(/)区切りで各最下位ユニットの作業段階を指定<br>
            <strong>作業段階:</strong> 1=未着手, 2=ネーム済, 3=下書済, 4=ペン入済, 5=仕上済
          </div>
        </div>
      </EditModal>
    </template>
  </section>
</template>
