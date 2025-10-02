<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useRoute, useRouter, onBeforeRouteLeave } from "vue-router";

// import PagePanel from "./components/PagePanel.vue"; // 一時的に無効化
import PanelStyleUnitEditor from "./components/PanelStyleUnitEditor.vue";
import ProgressHeatmap from "./components/ProgressHeatmap.vue";
import WorkSummaryCard from "./components/WorkSummaryCard.vue";
import WorkSettingsEditor from "./components/WorkSettingsEditor.vue";

import { normalizeStageColorValue } from "@/modules/works/utils/stageColor";
import { useAuthStore } from "@/store/authStore";
import { useSettingsStore } from "@/store/settingsStore";
import { WORK_STATUSES, useWorksStore, type WorkStatus, type WorkUnit } from "@/store/worksStore";

const route = useRoute();
const router = useRouter();
const workId = route.params.id as string;

const authStore = useAuthStore();
const settingsStore = useSettingsStore();
const worksStore = useWorksStore();

const { user } = storeToRefs(authStore);
const { granularities, granularitiesLoaded, loadingGranularities, stageWorkloads, stageWorkloadsLoaded, loadingStageWorkloads } = storeToRefs(settingsStore);

const work = computed(() => worksStore.getWorkById(workId));

const stageLabels = computed(() => workStageWorkloads.value.map((stage) => stage.label));
const stageColors = computed(() => {
  const total = workStageWorkloads.value.length;
  return workStageWorkloads.value.map((stage, index) => normalizeStageColorValue(stage.color, index, total));
});
const stageCount = computed(() => stageLabels.value.length);

const stageWorkloadHours = computed(() => {
  const workData = work.value;
  if (!workData?.primaryGranularityId || workStageWorkloads.value.length === 0) {
    return [];
  }

  return workStageWorkloads.value.map(stage => {
    const entry = stage.entries.find(e => e.granularityId === workData.primaryGranularityId);
    return entry?.hours ?? 0;
  });
});

// 作品固有の設定または全体設定を使用
const workGranularities = computed(() => {
  // 作品固有の設定があればそれを使用、なければ全体設定を使用
  if (work.value?.workGranularities && work.value.workGranularities.length > 0) {
    return work.value.workGranularities;
  }
  return granularities.value;
});

const workStageWorkloads = computed(() => {
  // 作品固有の設定があればそれを使用、なければ全体設定を使用
  if (work.value?.workStageWorkloads && work.value.workStageWorkloads.length > 0) {
    return work.value.workStageWorkloads;
  }
  return stageWorkloads.value;
});

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

const userId = computed(() => user.value?.uid ?? null);

const isSavingWork = computed(() => (work.value ? worksStore.isSavingWork(work.value.id) : false));
const canSaveWork = computed(() => (work.value ? worksStore.isWorkDirty(work.value.id) : false));
const saveErrorMessage = computed(() => (work.value ? worksStore.getSaveError(work.value.id) : null));

const lastSaveStatus = ref<string | null>(null);
const isEditMode = ref(false);
const savingPanelIds = ref(new Set<string>());

const toggleEditMode = () => {
  isEditMode.value = !isEditMode.value;

  // 編集モードを出る際に未保存の変更を破棄
  if (!isEditMode.value && work.value && canSaveWork.value) {
    worksStore.discardWorkChanges(work.value.id);
    // フォームを元の値に戻す
    if (work.value) {
      detailForm.title = work.value.title;
      detailForm.status = work.value.status;
      detailForm.startDate = work.value.startDate;
      detailForm.deadline = work.value.deadline;

      // 設定フォームも元に戻す
      settingsForm.workGranularities = workGranularities.value.slice();
      settingsForm.workStageWorkloads = workStageWorkloads.value.map(stage => ({
        ...stage,
        entries: stage.entries.slice()
      }));
    }
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
    settingsForm.workStageWorkloads = workStageWorkloads.value.map(stage => ({
      ...stage,
      entries: stage.entries.slice()
    }));

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
  worksStore.addRootUnit(workId);
};

const handleAddChildUnit = (payload: { parentId: string }) => {
  worksStore.addChildUnit(workId, payload.parentId);
};

const handleRemoveUnit = (payload: { unitId: string }) => {
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

              <!-- 編集モードでの設定編集 -->
              <div v-if="isEditMode" class="mt-4 border-top pt-4">
                <WorkSettingsEditor
                  v-model:work-granularities="settingsForm.workGranularities"
                  v-model:work-stage-workloads="settingsForm.workStageWorkloads"
                />
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
                @request-save="handleSave"
                @request-delete="requestWorkDeletion"
                @toggle-edit-mode="toggleEditMode"
              />
            </div>
          </div>

          <div class="card shadow-sm">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <h2 class="h5 mb-0">進捗ヒートマップ</h2>
                <span class="badge text-bg-light">更新: {{ formatDate(work.updatedAt) }}</span>
              </div>
              <ProgressHeatmap :units="work.units" :stage-count="stageCount" :stage-labels="stageLabels" :stage-colors="stageColors" />
            </div>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>
