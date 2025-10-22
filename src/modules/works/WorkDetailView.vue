<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useRoute, useRouter, onBeforeRouteLeave } from "vue-router";
// import PagePanel from "./components/PagePanel.vue"; // 一時的に無効化
import PanelStyleUnitEditor from "./components/PanelStyleUnitEditor.vue";
import ProgressHeatmap from "./components/ProgressHeatmap.vue";
import WorkSummaryCard from "./components/WorkSummaryCard.vue";
import WorkloadSettingsEditor from "@/components/common/WorkloadSettingsEditor.vue";

import { normalizeStageColorValue } from "@/modules/works/utils/stageColor";
import { useAuthStore } from "@/store/authStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useCustomDatesStore } from "@/store/customDatesStore";
import { WORK_STATUSES, useWorksStore, type WorkStatus, type WorkUnit, type WorkGranularity, type WorkStageWorkload } from "@/store/worksStore";
import { useWorkMetrics } from "@/composables/useWorkMetrics";
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

const stageWorkloadHours = computed(() => {
  const workData = work.value;
  if (!workData?.primaryGranularityId || workStageWorkloads.value.length === 0) {
    return [];
  }

  return workStageWorkloads.value.map(stage => {
    // 新しいbaseHours構造に対応
    if ('baseHours' in stage && stage.baseHours !== null && stage.baseHours !== undefined) {
      // baseHoursは最低粒度での工数なので、そのまま返す
      // 表示は主要粒度単位で行うが、工数の値は最低粒度ベース
      return stage.baseHours;
    }

    // 後方互換性: entries構造の場合
    if ('entries' in stage && Array.isArray(stage.entries)) {
      // 最低粒度のエントリを探す
      const lowestGranularity = workGranularities.value.reduce((min, current) =>
        current.weight < min.weight ? current : min
      );

      const lowestEntry = stage.entries.find(e => e.granularityId === lowestGranularity.id);
      if (lowestEntry?.hours != null) {
        return lowestEntry.hours;
      }

      // 他の粒度から最低粒度の工数を逆算
      for (const entry of stage.entries) {
        if (entry.hours != null) {
          const entryGranularity = workGranularities.value.find(g => g.id === entry.granularityId);
          if (entryGranularity) {
            const ratio = lowestGranularity.weight / entryGranularity.weight;
            return entry.hours * ratio;
          }
        }
      }
    }

    return 0;
  });
});

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
const stageColors = computed(() => {
  const total = workStageWorkloads.value.length;
  return workStageWorkloads.value.map((stage, index) => normalizeStageColorValue(stage.color, index, total));
});
const stageCount = computed(() => stageLabels.value.length);

// 重みでソートした粒度配列（高い重み→低い重み）
const sortedGranularities = computed(() => {
  return [...workGranularities.value].sort((a, b) => b.weight - a.weight);
});

const primaryGranularityLabel = computed(() => {
  const id = work.value?.primaryGranularityId;
  if (!id) {
    return null;
  }
  return workGranularities.value.find((item) => item.id === id)?.label ?? null;
});

// 各工程の最低粒度での工数を計算
const stageBaseHours = computed(() => {
  if (workStageWorkloads.value.length === 0 || workGranularities.value.length === 0) {
    return [];
  }

  // 最低粒度を取得
  const lowestGranularity = workGranularities.value.reduce((min, current) =>
    current.weight < min.weight ? current : min
  );

  return workStageWorkloads.value.map((stage, index) => {
    let baseHours = 0;

    // 新しいbaseHours構造に対応
    if ('baseHours' in stage && stage.baseHours !== null && stage.baseHours !== undefined) {
      baseHours = stage.baseHours;
    } else if ('entries' in stage && Array.isArray(stage.entries)) {
      // 後方互換性: entries構造の場合、最低粒度のエントリを探す
      const lowestEntry = stage.entries.find(entry => entry.granularityId === lowestGranularity.id);
      if (lowestEntry && lowestEntry.hours !== null && lowestEntry.hours !== undefined) {
        baseHours = lowestEntry.hours;
      } else {
        // 他の粒度から逆算
        for (const entry of stage.entries) {
          if (entry.hours !== null && entry.hours !== undefined) {
            const entryGranularity = workGranularities.value.find(g => g.id === entry.granularityId);
            if (entryGranularity) {
              baseHours = (entry.hours * lowestGranularity.weight) / entryGranularity.weight;
              break;
            }
          }
        }
      }
    }

    return {
      label: stage.label,
      color: stageColors.value[index] || '#666666',
      hours: baseHours
    };
  }); // 0時間の工程も表示する
});

const userId = computed(() => user.value?.uid ?? null);

// 背景色に対して適切なテキスト色を返す関数
const getContrastColor = (backgroundColor: string) => {
  // カラーコードから RGB 値を抽出
  const hex = backgroundColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // 明度を計算 (0-255)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;

  // 明度が128より大きい場合は黒、そうでなければ白
  return brightness > 128 ? '#000000' : '#ffffff';
};

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
  if (isSettingsEditMode.value && hasUnsavedSettings.value) {
    const confirmed = window.confirm('未保存の設定変更があります。破棄してよろしいですか？');
    if (!confirmed) {
      return;
    }
  }

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
    // 編集モード開始時にフォームをクリア
    structureEditForm.structureString = "";
    structureEditError.value = null;
  }
};

// 構造文字列をクリップボードにコピー
const copyStructureString = async () => {
  try {
    await navigator.clipboard.writeText(currentStructureString.value);
    // 成功の視覚的フィードバックを追加することも可能
    console.log('構造文字列をクリップボードにコピーしました');
  } catch (error) {
    console.error('クリップボードへのコピーに失敗しました:', error);
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

const overallProgress = computed(() => {
  if (!work.value || stageCount.value === 0 || work.value.units.length === 0) {
    return 0;
  }

  const leafUnits = collectLeafUnits(work.value.units);
  const totalUnits = leafUnits.length;

  if (totalUnits === 0) {
    return 0;
  }

  // 工数ベースの進捗計算
  if (work.value.primaryGranularityId && stageWorkloads.value.length > 0) {
    // 各段階の累積工数を計算
    const cumulativeWorkloads = stageWorkloadHours.value.reduce((acc, hours, index) => {
      const prevTotal = index > 0 ? (acc[index - 1] ?? 0) : 0;
      acc.push(prevTotal + hours);
      return acc;
    }, [] as number[]);

    const totalWorkHoursPerUnit = cumulativeWorkloads[cumulativeWorkloads.length - 1] || 0;
    const totalWorkHours = totalWorkHoursPerUnit * totalUnits;

    if (totalWorkHours === 0) {
      return 0;
    }

    // 各ユニットの完了工数を計算
    const completedWorkHours = leafUnits.reduce((sum, unit) => {
      const stageIndex = unit.stageIndex ?? 0;
      const completedHours = stageIndex < cumulativeWorkloads.length ? (cumulativeWorkloads[stageIndex] || 0) : 0;
      return sum + completedHours;
    }, 0);

    return Math.round((completedWorkHours / totalWorkHours) * 100);
  } else {
    // 従来の単純な進捗計算（工数データがない場合）
    const completedUnits = leafUnits.filter(unit => (unit.stageIndex ?? 0) >= stageCount.value - 1).length;
    return Math.round((completedUnits / totalUnits) * 100);
  }
});

const totalPanels = computed(() => work.value?.totalUnits ?? 0);

// 実際の進捗計算で使用される工数
const actualWorkHours = computed(() => {
  if (!work.value) {
    return { totalEstimatedHours: 0, remainingEstimatedHours: 0 };
  }
  return worksStore.calculateActualWorkHours(work.value.id);
});

// 作品の指標を計算
const workMetrics = useWorkMetrics(work);

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
    lastSaveStatus.value = "保存しました。";

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

const formatDate = (value: string) => {
  if (!value) {
    return "";
  }
  try {
    return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return value;
  }
};
</script>

<template>
  <section class="container py-5">
    <div v-if="!work" class="alert alert-warning" role="alert">
      指定された作品が見つかりませんでした。
      <button type="button" class="btn btn-link px-1" @click="goBackToList">作品一覧に戻る</button>
    </div>

    <template v-else>
      <header class="d-flex flex-column flex-lg-row align-items-start align-items-lg-center justify-content-between gap-3 mb-4">
        <div>
          <h1 class="h3 fw-semibold mb-1">{{ work.title || "作品詳細" }}</h1>
          <p class="text-muted mb-0">ID: {{ work.id }}</p>
        </div>
        <div class="text-lg-end">
          <p class="mb-0 text-muted small">
            最上位粒度: <strong>{{ primaryGranularityLabel ?? "未設定" }}</strong>
          </p>
          <p class="mb-0 text-muted small">
            ユニット数: <strong>{{ work.units.length }}</strong> / 総要素数: <strong>{{ totalPanels }}</strong>
          </p>
        </div>
      </header>

      <div class="row g-4 mb-4">
        <div class="col-12">
          <div class="card shadow-sm">
            <div class="card-body">
              <div class="row g-3">
                <div class="col-12 col-md-6 col-xl-4">
                  <label class="form-label" for="detail-title">タイトル</label>
                  <input id="detail-title" v-model="detailForm.title" type="text" class="form-control" placeholder="作品タイトル" :readonly="!isEditMode" />
                </div>
                <div class="col-12 col-md-3 col-xl-2">
                  <label class="form-label" for="detail-status">ステータス</label>
                  <select id="detail-status" v-model="detailForm.status" class="form-select" :disabled="!isEditMode">
                    <option v-for="option in WORK_STATUSES" :key="option" :value="option">{{ option }}</option>
                  </select>
                </div>
                <div class="col-12 col-md-3 col-xl-2">
                  <label class="form-label" for="detail-start">開始日</label>
                  <input id="detail-start" v-model="detailForm.startDate" type="date" class="form-control" :max="detailForm.deadline || undefined" :readonly="!isEditMode" />
                </div>
                <div class="col-12 col-md-3 col-xl-2">
                  <label class="form-label" for="detail-deadline">締め切り</label>
                  <input id="detail-deadline" v-model="detailForm.deadline" type="date" class="form-control" :min="detailForm.startDate || undefined" :readonly="!isEditMode" />
                </div>
                <div class="col-12 col-md-3 col-xl-2">
                  <label class="form-label">推定総工数</label>
                  <div class="form-control-plaintext fw-semibold">{{ actualWorkHours.totalEstimatedHours.toFixed(2) }} h</div>
                </div>
                <div class="col-12 col-md-3 col-xl-2">
                  <label class="form-label">推定残工数</label>
                  <div class="form-control-plaintext fw-semibold">{{ actualWorkHours.remainingEstimatedHours.toFixed(2) }} h</div>
                </div>
              </div>

              <!-- 工程別工数表示 -->
              <div v-if="stageBaseHours.length > 0" class="mt-3 pt-3 border-top">
                <div class="mb-2">
                  <small class="text-muted">工程別工数（最低粒度）:</small>
                </div>
                <div class="d-flex flex-wrap gap-2">
                  <span
                    v-for="stage in stageBaseHours"
                    :key="stage.label"
                    class="badge fs-6 px-3 py-2"
                    :style="{ backgroundColor: stage.color, color: getContrastColor(stage.color) }"
                  >
                    {{ stage.label }}（{{ stage.hours.toFixed(1) }}h）
                  </span>
                </div>
              </div>

              <!-- 作品固有設定 -->
              <div class="mt-4 border-top pt-4">
                <div class="d-flex justify-content-between align-items-center mb-3">
                  <h6 class="mb-0">作品固有設定</h6>
                  <button
                    type="button"
                    class="btn btn-sm"
                    :class="isSettingsEditMode ? 'btn-outline-secondary' : 'btn-outline-primary'"
                    @click="toggleSettingsEditMode"
                  >
                    <i class="bi" :class="isSettingsEditMode ? 'bi-x' : 'bi-gear'"></i>
                    {{ isSettingsEditMode ? 'キャンセル' : '設定を編集' }}
                  </button>
                </div>

                <div v-if="!isSettingsEditMode" class="text-muted">
                  <div class="mb-2">
                    <strong>粒度設定:</strong>
                    {{ originalWorkGranularities.length > 0
                       ? originalWorkGranularities.map(g => `${g.label}(${g.defaultCount}個)`).join(' → ')
                       : 'デフォルト設定を使用' }}
                  </div>
                  <div>
                    <strong>ステージ設定:</strong>
                    {{ originalWorkStageWorkloads.length > 0
                       ? originalWorkStageWorkloads.length + '個のステージ'
                       : 'デフォルト設定を使用' }}
                  </div>
                </div>

                <div v-if="isSettingsEditMode">
                  <WorkloadSettingsEditor
                    work-mode
                    :work-granularities="localWorkGranularities"
                    :work-stage-workloads="localWorkStageWorkloads"
                    :work-data="work"
                    @granularity-change="handleGranularityChange"
                    @stage-workload-change="handleStageWorkloadChange"
                    @bulk-stage-update="handleBulkStageUpdate"
                  />

                  <!-- 設定保存/キャンセルボタン -->
                  <div v-if="hasUnsavedSettings" class="mt-3 d-flex gap-2">
                    <button
                      type="button"
                      class="btn btn-success"
                      @click="saveSettings"
                      :disabled="isSavingSettings"
                    >
                      <span v-if="isSavingSettings" class="spinner-border spinner-border-sm me-2"></span>
                      <i class="bi bi-check me-1"></i>
                      作品設定を保存
                    </button>
                    <button
                      type="button"
                      class="btn btn-outline-secondary"
                      @click="discardSettings"
                    >
                      <i class="bi bi-x me-1"></i>
                      変更を破棄
                    </button>
                  </div>
                </div>

                <!-- 作品構造編集 -->
                <div class="mt-4 border-top pt-4">
                  <div class="d-flex justify-content-between align-items-center mb-3">
                    <h6 class="mb-0">作品構造編集</h6>
                    <button
                      type="button"
                      class="btn btn-sm"
                      :class="isStructureEditMode ? 'btn-outline-secondary' : 'btn-outline-primary'"
                      @click="toggleStructureEditMode"
                    >
                      <i class="bi" :class="isStructureEditMode ? 'bi-x' : 'bi-pencil'"></i>
                      {{ isStructureEditMode ? 'キャンセル' : '作品を編集する' }}
                    </button>
                  </div>

                  <div v-if="!isStructureEditMode" class="text-muted">
                    <p class="mb-0">構造指定文字列を使用して作品の構造と作業段階を一括更新できます。</p>
                  </div>

                  <div v-if="isStructureEditMode">
                    <div class="mb-3">
                      <label for="structure-input" class="form-label">構造指定文字列</label>
                      <textarea
                        id="structure-input"
                        v-model="structureEditForm.structureString"
                        class="form-control"
                        :class="{ 'is-invalid': structureEditError }"
                        rows="3"
                        placeholder="例: [1],[5/5/5/5/5],[5/5/5/4]"
                      ></textarea>
                      <div v-if="structureEditError" class="invalid-feedback">
                        {{ structureEditError }}
                      </div>
                      <div class="form-text">
                        <strong>書式:</strong><br>
                        • 最上位ユニット：カンマ(,)区切りで分割<br>
                        • 各最上位ユニット：角括弧[]で囲む<br>
                        • 作業段階：スラッシュ(/)区切りで各最下位ユニットの作業段階を指定<br>
                        <strong>作業段階:</strong> 1=未着手, 2=ネーム済, 3=下書済, 4=ペン入済, 5=仕上済
                      </div>
                    </div>

                    <div class="d-flex gap-2">
                      <button
                        type="button"
                        class="btn btn-success"
                        @click="applyStructureChanges"
                        :disabled="isSavingStructure || !structureEditForm.structureString.trim()"
                      >
                        <span v-if="isSavingStructure" class="spinner-border spinner-border-sm me-2"></span>
                        <i class="bi bi-check me-1"></i>
                        構造を更新
                      </button>
                      <button
                        type="button"
                        class="btn btn-outline-secondary"
                        @click="toggleStructureEditMode"
                      >
                        <i class="bi bi-x me-1"></i>
                        キャンセル
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="row g-4">
        <div class="col-12 col-xl-8">
          <div class="card shadow-sm h-100">
            <div class="card-body d-flex flex-column">
              <div class="mb-3">
                <h2 class="h5 mb-1">作品構造管理</h2>
                <p class="text-muted mb-0">階層構造でユニットを管理できます。要素をクリックして作業段階を進めましょう。</p>
              </div>
              <PanelStyleUnitEditor
                :units="work.units"
                :stage-count="stageCount"
                :stage-labels="stageLabels"
                :stage-colors="stageColors"
                :stage-workloads="stageWorkloadHours"
                :granularities="sortedGranularities"
                :is-edit-mode="isEditMode"
                :saving-unit-ids="savingPanelIds"
                @advance-stage="handleAdvanceUnitStage"
                @add-root-unit="handleAddRootUnit"
                @add-child="handleAddChildUnit"
                @remove-unit="handleRemoveUnit"
                @update-children-count="handleUpdateChildrenCount"
              />

              <!-- 現在の構造文字列を表示 -->
              <div class="mt-3 pt-3 border-top">
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <h6 class="mb-0 text-muted">現在の構造</h6>
                  <button
                    v-if="currentStructureString !== '構造が設定されていません'"
                    type="button"
                    class="btn btn-sm btn-outline-secondary"
                    @click="copyStructureString"
                    title="構造文字列をコピー"
                  >
                    <i class="bi bi-clipboard"></i>
                  </button>
                </div>
                <div class="bg-light p-2 rounded">
                  <code class="text-dark">{{ currentStructureString }}</code>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="col-12 col-xl-4 d-flex flex-column gap-4">
          <div class="card shadow-sm">
            <div class="card-body">
              <h2 class="h5 mb-3">作品概要</h2>
              <WorkSummaryCard
                :work="work"
                :stage-count="stageCount"
                :progress-percent="overallProgress"
                :primary-granularity-label="primaryGranularityLabel"
                :total-panels="totalPanels"
                :saving="isSavingWork"
                :can-save="canSaveWork"
                :save-error="saveErrorMessage"
                :last-save-status="lastSaveStatus"
                :is-edit-mode="isEditMode"
                :actual-work-hours="actualWorkHours"
                :work-metrics="{
                  remainingEstimatedHours: workMetrics.remainingEstimatedHours.value,
                  availableWorkHours: workMetrics.availableWorkHours.value,
                  requiredDailyHours: workMetrics.requiredDailyHours.value,
                  daysUntilDeadline: workMetrics.daysUntilDeadline.value
                }"
                @request-save="handleSave"
                @request-delete="requestWorkDeletion"
                @toggle-edit-mode="toggleEditMode"
              />
            </div>
          </div>

          <div class="card shadow-sm">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <h2 class="h5 mb-0">工程別進捗</h2>
                <span class="badge text-bg-light">更新: {{ formatDate(work.updatedAt) }}</span>
              </div>
              <ProgressHeatmap
                :units="work.units"
                :stage-count="stageCount"
                :stage-labels="stageLabels"
                :stage-colors="stageColors"
                :stage-workload-hours="stageWorkloadHours"
              />
            </div>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>
