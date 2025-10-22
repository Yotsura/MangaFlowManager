<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch, onActivated } from "vue";
import { storeToRefs } from "pinia";
import { useRouter } from "vue-router";

import { useAuthStore } from "@/store/authStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useWorksStore, WORK_STATUSES, type Work, type WorkStatus } from "@/store/worksStore";
import { useWorkMetrics } from "@/composables/useWorkMetrics";
import {
  parseStructureString as parseStructure,
  validateStructureString as validateStructure,
  convertToWorkStructure,
  type TopLevelUnit
} from "@/utils/structureParser";

const authStore = useAuthStore();
const settingsStore = useSettingsStore();
const worksStore = useWorksStore();
const router = useRouter();

const { user } = storeToRefs(authStore);
const { granularities, granularitiesLoaded, loadingGranularities, stageWorkloads, stageWorkloadsLoaded, loadingStageWorkloads, granularitiesLoadError, stageWorkloadsLoadError } =
  storeToRefs(settingsStore);
const { works, loadingWorks, loadError, worksLoaded } = storeToRefs(worksStore);

const userId = computed(() => user.value?.uid ?? null);

const creationForm = reactive({
  title: "",
  status: WORK_STATUSES[0] as WorkStatus,
  granularityCounts: {} as Record<string, number>, // 粒度IDごとの数量
  startDate: new Date().toISOString().slice(0, 10),
  deadline: "",
  structureString: "", // 文字列による作品構造指定
});

const fieldErrors = reactive<Record<string, string | null>>({
  title: null,
  startDate: null,
  deadline: null,
  structureString: null,
});

const creationError = ref<string | null>(null);
const isSubmitting = ref(false);
const attempted = ref(false);
const showCreateForm = ref(false);

// 粒度を重みの高い順でソート
const sortedGranularities = computed(() => {
  return [...granularities.value].sort((a, b) => b.weight - a.weight);
});

const topGranularity = computed(() => {
  return sortedGranularities.value[0] ?? null;
});

// 粒度フィールドのエラー
const granularityFieldErrors = reactive<Record<string, string | null>>({});

// 粒度設定が変更されたときにフォームを初期化
const initializeGranularityForm = () => {
  const newCounts: Record<string, number> = {};
  const newErrors: Record<string, string | null> = {};

  sortedGranularities.value.forEach((granularity, index) => {
    // 最上位粒度以外に粒度設定のデフォルト値を設定
    if (index > 0) {
      newCounts[granularity.id] = granularity.defaultCount || 1;
    }
    newErrors[granularity.id] = null;
  });

  creationForm.granularityCounts = newCounts;
  Object.keys(granularityFieldErrors).forEach(key => {
    delete granularityFieldErrors[key];
  });
  Object.assign(granularityFieldErrors, newErrors);
};

// 最上位粒度の数量を取得
const topGranularityCount = computed({
  get: () => {
    if (!topGranularity.value) return 6;
    return creationForm.granularityCounts[topGranularity.value.id] ?? 6;
  },
  set: (value: number) => {
    if (!topGranularity.value) return;
    creationForm.granularityCounts[topGranularity.value.id] = value;
  }
});

// 作品を新しく作成した順（作成日時の降順）でソート
const sortedWorks = computed(() => {
  return [...works.value].sort((a, b) => {
    // createdAtを日付として比較（新しい順）
    const dateA = new Date(a.createdAt);
    const dateB = new Date(b.createdAt);
    return dateB.getTime() - dateA.getTime();
  });
});

const stageLabels = computed(() => {
  if (!stageWorkloads.value || !Array.isArray(stageWorkloads.value)) {
    return [];
  }
  return stageWorkloads.value.map((stage) => stage.label);
});
const stageCount = computed(() => stageLabels.value.length);

const unitEstimatedHours = computed(() => {
  const primary = topGranularity.value;
  if (!primary) {
    return 0;
  }

  // stageWorkloadsが存在し、配列であることを確認
  if (!stageWorkloads.value || !Array.isArray(stageWorkloads.value)) {
    return 0;
  }

  return stageWorkloads.value.reduce((total, stage) => {
    // 新しい baseHours ベースの構造に対応
    if (stage.baseHours === null || stage.baseHours === undefined) {
      return total;
    }

    // 最低粒度を取得
    const lowestGranularity = granularities.value.reduce((min, current) =>
      current.weight < min.weight ? current : min
    );

    // primary粒度での工数を計算
    if (primary.id === lowestGranularity.id) {
      // primaryが最低粒度の場合、baseHoursをそのまま使用
      return total + stage.baseHours;
    } else {
      // primaryが最低粒度より上位の場合、比重を使って変換
      const ratio = primary.weight / lowestGranularity.weight;
      return total + (stage.baseHours * ratio);
    }
  }, 0);
});

const totalEstimatedHours = computed(() => Number((topGranularityCount.value * unitEstimatedHours.value).toFixed(2)));

const isSettingsLoading = computed(() => loadingGranularities.value || loadingStageWorkloads.value);
const settingsError = computed(() => granularitiesLoadError.value ?? stageWorkloadsLoadError.value ?? null);

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
};

const ensureWorksLoaded = async () => {
  if (!userId.value) {
    return;
  }

  if (!worksLoaded.value && !loadingWorks.value) {
    await worksStore.fetchWorks(userId.value);
  }
};

// 粒度設定が変更されたときにフォームを初期化
watch(granularities, () => {
  initializeGranularityForm();
}, { deep: true });

// 設定をコピーする関数
const copyCurrentSettings = () => {
  const workGranularities = granularities.value.map(g => ({
    id: g.id,
    label: g.label,
    weight: g.weight,
    defaultCount: g.defaultCount
  }));

  if (!stageWorkloads.value || !Array.isArray(stageWorkloads.value)) {
    return { workGranularities, workStageWorkloads: [] };
  }

  const workStageWorkloads = stageWorkloads.value.map(stage => ({
    id: stage.id,
    label: stage.label,
    color: stage.color,
    baseHours: stage.baseHours
  }));

  return { workGranularities, workStageWorkloads };
};

// 構造解析は外部ユーティリティを使用

// カスタム検証関数（設定との整合性チェック）
const validateStructureWithSettings = (structureStr: string): string | null => {
  if (!structureStr.trim()) {
    return null; // 空文字列は有効（通常の入力方式を使用）
  }

  const granularityCount = sortedGranularities.value.length;
  if (granularityCount === 0) {
    return "粒度設定が未完了のため、文字列構造は使用できません。";
  }

  const parsed = parseStructure(structureStr, granularityCount);
  if (!parsed) {
    return "書式が正しくありません。角括弧[]、カンマ(,)、スラッシュ(/)の構文を確認するか、階層数が粒度設定と一致しているか確認してください。";
  }

  // 各最上位単位の階層数をチェック
  for (let i = 0; i < parsed.topLevelUnits.length; i++) {
    const unit = parsed.topLevelUnits[i];
    const counts = unit.counts;
    const stages = unit.stages;

    // 粒度設定を超える階層が指定されていないかチェック
    if (counts.length > granularityCount) {
      return `${i + 1}番目の最上位単位の階層数（${counts.length}階層）が設定の粒度数（${granularityCount}階層）を超えています。`;
    }

    // 各数値が正の整数かチェック
    for (let j = 0; j < counts.length; j++) {
      if (!Number.isInteger(counts[j]) || counts[j] <= 0) {
        return `${i + 1}番目の最上位単位の${j + 1}階層目の数値が無効です（正の整数である必要があります）。`;
      }
    }

    // 作業段階インデックスが指定されている場合の検証
    if (stages.length > 0) {
      // 新しい記法では、subUnitsの詳細情報を使用して検証
      const unitWithSubUnits = unit as TopLevelUnit & { subUnits?: { count: number; stages: number[] }[] };

      if (unitWithSubUnits.subUnits) {
        // 各subUnitの作業段階インデックス数が正しいかチェック
        for (let j = 0; j < unitWithSubUnits.subUnits.length; j++) {
          const subUnit = unitWithSubUnits.subUnits[j];

          // 作業段階インデックスの値をチェック
          for (let k = 0; k < subUnit.stages.length; k++) {
            const stageIndex = subUnit.stages[k];
            if (stageIndex < 0) {
              return `${i + 1}番目の最上位単位の${j + 1}番目のサブユニットの${k + 1}番目の作業段階インデックスが無効です（0以上の整数である必要があります）。`;
            }
          }
        }
      } else {
        // subUnits情報がない場合は従来の検証方法
        for (let k = 0; k < stages.length; k++) {
          const stageIndex = parseInt(stages[k]);
          if (isNaN(stageIndex) || stageIndex < 0) {
            return `${i + 1}番目の最上位単位の${k + 1}番目の作業段階インデックスが無効です（0以上の整数である必要があります）。`;
          }
        }
      }
    }
  }

  return null;
};

const loadData = async () => {
  if (!user.value) {
    await authStore.ensureInitialized();
  }

  await ensureSettingsLoaded();
  await ensureWorksLoaded();
  initializeGranularityForm();
};

onMounted(async () => {
  await loadData();
});

// ページ遷移やコンポーネント再活性化時にもデータを確認
onActivated(async () => {
  await loadData();
});

watch(userId, async (next, prev) => {
  if (next && next !== prev) {
    await ensureSettingsLoaded();
    await ensureWorksLoaded();
    initializeGranularityForm();
  }
});

const resetErrors = () => {
  Object.keys(fieldErrors).forEach((key) => {
    fieldErrors[key] = null;
  });
  creationError.value = null;
};

const validate = () => {
  resetErrors();
  let hasError = false;

  if (!creationForm.title.trim()) {
    fieldErrors.title = "タイトルを入力してください。";
    hasError = true;
  }

  if (!creationForm.startDate) {
    fieldErrors.startDate = "開始日時を入力してください。";
    hasError = true;
  }

  // 文字列構造が入力されている場合の検証
  if (creationForm.structureString.trim()) {
    const structureError = validateStructureWithSettings(creationForm.structureString);
    if (structureError) {
      fieldErrors.structureString = structureError;
      hasError = true;
    }
  } else {
    // 通常入力方式の検証
    // 最上位粒度の数をチェック
    if (!Number.isFinite(topGranularityCount.value) || topGranularityCount.value <= 0) {
      if (topGranularity.value) {
        granularityFieldErrors[topGranularity.value.id] = "1以上で入力してください。";
      }
      hasError = true;
    }

    // 各粒度の数をチェック
    sortedGranularities.value.slice(1).forEach(granularity => {
      const count = creationForm.granularityCounts[granularity.id] ?? 0;
      if (!Number.isFinite(count) || count <= 0) {
        granularityFieldErrors[granularity.id] = "1以上で入力してください。";
        hasError = true;
      } else {
        granularityFieldErrors[granularity.id] = null;
      }
    });
  }

  if (!topGranularity.value) {
    creationError.value = "作業粒度設定が未完了のため、作品を作成できません。";
    hasError = true;
  }

  if (stageCount.value === 0) {
    creationError.value = "作業工数設定が未完了のため、作品を作成できません。";
    hasError = true;
  }

  return !hasError;
};

// 新規作成フォームの表示切り替え
const toggleCreateForm = () => {
  if (!showCreateForm.value) {
    // フォームを開く際は初期化
    showCreateForm.value = true;
    initializeGranularityForm();
  } else {
    // フォームを閉じる際はフォームをリセット
    resetCreateForm();
  }
};

// フォームのリセット
const resetCreateForm = () => {
  creationForm.title = "";
  creationForm.status = WORK_STATUSES[0] as WorkStatus;
  creationForm.granularityCounts = {};
  creationForm.startDate = new Date().toISOString().slice(0, 10);
  creationForm.deadline = "";
  creationForm.structureString = "";

  // エラー状態もリセット
  Object.keys(fieldErrors).forEach(key => {
    fieldErrors[key] = null;
  });
  Object.keys(granularityFieldErrors).forEach(key => {
    granularityFieldErrors[key] = null;
  });
  creationError.value = null;
  attempted.value = false;

  // フォームを非表示にする
  showCreateForm.value = false;
};

const handleCreate = () => {
  attempted.value = true;
  if (!validate()) {
    return;
  }

  if (!topGranularity.value) {
    return;
  }

  const startDate = creationForm.startDate || new Date().toISOString().slice(0, 10);
  const deadline = creationForm.deadline || "";

  isSubmitting.value = true;

  try {
    const { workGranularities, workStageWorkloads } = copyCurrentSettings();

    // 文字列構造が入力されている場合の処理
    if (creationForm.structureString.trim()) {
      const granularityCount = sortedGranularities.value.length;
      const parsed = parseStructure(creationForm.structureString, granularityCount);
      if (!parsed) {
        creationError.value = "文字列の解析に失敗しました。階層数が粒度設定と一致しているか確認してください。";
        return;
      }

      console.log('新記法解析結果:', parsed);

      // 新記法では、カンマ区切りで最上位単位を分割
      // 各最上位単位は1個として計算し、その下位構造を持つ
      const totalTopLevelUnits = parsed.topLevelUnits.length;

      // 構造の一致性をチェック（簡易版）
      const allStructuresMatch = parsed.topLevelUnits.every(unit => {
        return unit.counts.length === parsed.topLevelUnits[0].counts.length;
      });

      if (!allStructuresMatch) {
        creationError.value = "現在の実装では、すべての最上位単位が同じ階層構造を持つ必要があります。";
        return;
      }

      // 実際の最下位ユニット数を計算
      const totalLeafUnits = parsed.topLevelUnits.reduce((sum, unit) => {
        return sum + unit.stages.length;  // 各最上位単位の作業段階数 = 最下位ユニット数
      }, 0);

      // 各最上位単位の最下位ユニット数を配列で保持
      const leafUnitsPerTopUnit = parsed.topLevelUnits.map(unit => unit.stages.length);

      console.log('新記法による作品構造:', {
        title: creationForm.title,
        totalUnits: totalTopLevelUnits,
        totalLeafUnits,
        leafUnitsPerTopUnit,
        topLevelUnits: parsed.topLevelUnits,
        allStructuresMatch,
        detailedStructure: parsed.topLevelUnits.map((unit, index) => ({
          unitIndex: index,
          counts: unit.counts,
          stages: unit.stages,
          subUnits: (unit as TopLevelUnit & { subUnits?: { count: number; stages: number[] }[] }).subUnits
        }))
      });

      // 作品作成（構造指定対応）
      let work: Work;

      if (typeof worksStore.createWorkWithStructure === 'function') {
        // 新しいメソッドが利用可能な場合
        const workStructure = convertToWorkStructure(parsed);
        const structureData = workStructure.structureData;

        work = worksStore.createWorkWithStructure({
          title: creationForm.title,
          status: creationForm.status,
          startDate,
          deadline,
          primaryGranularityId: topGranularity.value.id,
          unitEstimatedHours: unitEstimatedHours.value,
          workGranularities,
          workStageWorkloads,
          structure: {
            topLevelUnits: structureData,
            hierarchicalUnits: workStructure.hierarchicalStructureData
          }
        });

        console.log('構造データ:', structureData);
      } else {
        // 代替案: 通常の作成を使用
        console.log('createWorkWithStructureメソッドが見つからないため、代替方法を使用します');

        work = worksStore.createWork({
          title: creationForm.title,
          status: creationForm.status,
          startDate,
          deadline,
          totalUnits: totalTopLevelUnits,
          defaultCounts: leafUnitsPerTopUnit,  // 各最上位単位の下位ユニット数
          primaryGranularityId: topGranularity.value.id,
          unitEstimatedHours: unitEstimatedHours.value,
          workGranularities,
          workStageWorkloads,
        });

        // 作成後に作業段階を適用
        const allStageIndices: number[] = [];
        parsed.topLevelUnits.forEach((topUnit, topIndex) => {
          console.log(`最上位単位${topIndex + 1}:`, topUnit);
          topUnit.stages.forEach((stageIndexStr, stageIdx) => {
            const userStageIndex = parseInt(stageIndexStr, 10);
            // ユーザー入力を0ベースインデックスに変換
            // ユーザー: 1=未着手, 2=ネーム済, 3=下書済, 4=ペン入済, 5=仕上済
            // システム: 0=未着手, 1=ネーム済, 2=下書済, 3=ペン入済, 4=仕上済
            const systemStageIndex = isNaN(userStageIndex) ? 0 : Math.max(0, userStageIndex - 1);
            console.log(`  作業段階${stageIdx + 1}: ユーザー入力"${stageIndexStr}" → システム値${systemStageIndex}`);
            allStageIndices.push(systemStageIndex);
          });
        });

        console.log('適用する作業段階インデックス:', allStageIndices);
        const success = worksStore.applyStageIndicesToLeafUnits(work.id, allStageIndices);
        console.log('作業段階適用結果:', success);
      }

      console.log('作成された作品:', work);
      router.push({ name: "work-detail", params: { id: work.id } });
    } else {
      // 通常の入力方式による作品作成
      const defaultCounts = sortedGranularities.value.slice(1).map(granularity =>
        creationForm.granularityCounts[granularity.id] ?? 6
      );

      const work = worksStore.createWork({
        title: creationForm.title,
        status: creationForm.status,
        startDate,
        deadline,
        totalUnits: topGranularityCount.value,
        defaultCounts,
        primaryGranularityId: topGranularity.value.id,
        unitEstimatedHours: unitEstimatedHours.value,
        workGranularities,
        workStageWorkloads,
      });

      router.push({ name: "work-detail", params: { id: work.id } });
    }

    // フォームをリセット
    creationForm.title = "";
    creationForm.startDate = new Date().toISOString().slice(0, 10);
    creationForm.deadline = "";
    creationForm.status = WORK_STATUSES[0];
    creationForm.structureString = "";
    initializeGranularityForm();
    attempted.value = false;
    resetErrors();

    // フォームを非表示にする
    showCreateForm.value = false;
  } catch (error) {
    console.error('作品作成エラー:', error);
    creationError.value = "作品の作成中にエラーが発生しました。";
  } finally {
    isSubmitting.value = false;
  }
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

// 最下位レベルのユニット（stageIndexを持つもの）を再帰的に収集
const collectLeafUnits = (units: Work['units']): Work['units'] => {
  const result: Work['units'] = [];
  for (const unit of units) {
    if (unit.stageIndex !== undefined) {
      result.push(unit);
    } else if (unit.children) {
      result.push(...collectLeafUnits(unit.children));
    }
  }
  return result;
};

const computeWorkProgress = (work: Work) => {
  if (!work.units || work.units.length === 0 || stageCount.value === 0) {
    return 0;
  }

  const leafUnits = collectLeafUnits(work.units);
  const totalUnits = leafUnits.length;

  if (totalUnits === 0) {
    return 0;
  }

  // 工数ベースの進捗計算
  if (work.primaryGranularityId && stageWorkloads.value && Array.isArray(stageWorkloads.value) && stageWorkloads.value.length > 0) {
    // 各段階の工数を取得（baseHoursから最上位粒度の工数を逆算）
    const primaryGranularity = granularities.value.find(g => g.id === work.primaryGranularityId);
    const lowestGranularity = granularities.value.reduce((min, current) =>
      current.weight < min.weight ? current : min
    );

    const stageHours = stageWorkloads.value.map(stage => {
      if (!stage.baseHours || !primaryGranularity || !lowestGranularity) return 0;
      // 最低粒度の工数から最上位粒度の工数を計算
      const ratio = primaryGranularity.weight / lowestGranularity.weight;
      return stage.baseHours * ratio;
    });

    // 各段階の累積工数を計算
    const cumulativeWorkloads = stageHours.reduce((acc, hours, index) => {
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
};

const totalPanelsForWork = (work: Work) => work.totalUnits;

// 作品ごとの実際の工数計算
const getWorkActualHours = (work: Work) => {
  return worksStore.calculateActualWorkHours(work.id);
};

// 作品ごとの指標を計算
const getWorkMetrics = (work: Work) => {
  const workRef = computed(() => work);
  return useWorkMetrics(workRef);
};

const navigateToDetail = (id: string) => {
  router.push({ name: "work-detail", params: { id } });
};

// デバッグ用：文字列解析テスト
const testStringParsing = () => {
  const testCases = [
    "[1],[4/4/4/4/4],[4/4/4/3]", // ユーザーの実際の例
    "[[1/2][3/1/2][1]],[[2/2/1/3]]", // 提案された新記法
    "[[1/2/3][2/1]]", // 2階層構造
    "[[1][2][3]]", // 各ユニット1個ずつ
    "[[1/1/1/1]]", // 単一ユニットに4個
    "[[2/2][1/3][2/1]],[[1/1][2/2]]" // 複数の最上位ユニット
  ];

  testCases.forEach(testCase => {
    console.log(`テスト: "${testCase}"`);
    const result = parseStructure(testCase);
    console.log('結果:', result);
    if (result) {
      const error = validateStructure(testCase);
      console.log('検証:', error || 'OK');

      // 合計最上位単位数を計算
      const total = result.topLevelUnits.reduce((sum, unit) => sum + unit.counts[0], 0);
      console.log('合計最上位単位数:', total);
    }
    console.log('---');
  });
};

// グローバルスコープに公開（デバッグ用）
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).testStringParsing = testStringParsing;
}
</script>

<template>
  <section class="container py-5">
    <header class="d-flex flex-column flex-lg-row align-items-start align-items-lg-center justify-content-between gap-3 mb-4">
      <div>
        <h1 class="h3 fw-semibold mb-1">作品管理</h1>
        <p class="text-muted mb-0">作品の新規作成と進捗確認を行います。</p>
      </div>
      <div class="text-lg-end">
        <p class="mb-0 text-muted small">
          最上位粒度: <strong>{{ topGranularity?.label ?? "未設定" }}</strong>
        </p>
        <p class="mb-0 text-muted small">
          1{{ topGranularity?.label ?? "単位" }}あたりの推定工数: <strong>{{ unitEstimatedHours.toFixed(2) }}h</strong>
        </p>
      </div>
    </header>

    <!-- 全体のローディング状態 -->
    <div v-if="!userId" class="alert alert-warning" role="alert">
      <div class="d-flex align-items-center">
        <div class="spinner-border spinner-border-sm me-2" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        ユーザー情報を確認中...
      </div>
    </div>

    <div v-else-if="isSettingsLoading && !granularitiesLoaded && !stageWorkloadsLoaded" class="alert alert-info" role="alert">
      <div class="d-flex align-items-center">
        <div class="spinner-border spinner-border-sm me-2" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        設定を読み込み中...
      </div>
    </div>

    <div v-else-if="settingsError" class="alert alert-danger" role="alert">設定を読み込めませんでした: {{ settingsError }}</div>

    <!-- 新規作品作成フォーム -->
    <div v-if="showCreateForm && userId && (granularitiesLoaded || stageWorkloadsLoaded)" class="card shadow-sm mb-5">
      <div class="card-body">
        <div class="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3 mb-3">
          <div>
            <h2 class="h5 fw-semibold mb-1">新規作品を登録</h2>
            <p class="text-muted mb-0">タイトル・粒度の数などを設定し、作品を作成します。</p>
          </div>
          <div class="d-flex gap-2">
            <button type="button" class="btn btn-outline-secondary" @click="resetCreateForm">キャンセル</button>
            <button type="button" class="btn btn-primary" :disabled="isSubmitting || isSettingsLoading" @click="handleCreate">作品を作成</button>
          </div>
        </div>

        <div v-if="creationError && attempted" class="alert alert-danger" role="alert">{{ creationError }}</div>

        <form class="row g-3">
          <div class="col-12 col-md-6">
            <label class="form-label" for="work-title">タイトル</label>
            <input
              id="work-title"
              v-model="creationForm.title"
              :class="['form-control', attempted && fieldErrors.title ? 'is-invalid' : '']"
              type="text"
              placeholder="例: 週刊連載 第1話"
              :disabled="isSubmitting || isSettingsLoading"
            />
            <div v-if="attempted && fieldErrors.title" class="invalid-feedback">{{ fieldErrors.title }}</div>
          </div>

          <div class="col-12 col-md-3">
            <label class="form-label" for="work-status">ステータス</label>
            <select id="work-status" v-model="creationForm.status" class="form-select" :disabled="isSubmitting || isSettingsLoading">
              <option v-for="status in WORK_STATUSES" :key="status" :value="status">{{ status }}</option>
            </select>
          </div>

          <div class="col-12 col-md-3">
            <label class="form-label" for="work-start">開始日</label>
            <input
              id="work-start"
              v-model="creationForm.startDate"
              :class="['form-control', attempted && fieldErrors.startDate ? 'is-invalid' : '']"
              type="date"
              :max="creationForm.deadline || undefined"
              :disabled="isSubmitting || isSettingsLoading"
            />
            <div v-if="attempted && fieldErrors.startDate" class="invalid-feedback">{{ fieldErrors.startDate }}</div>
          </div>

          <div class="col-12 col-md-3">
            <label class="form-label" for="work-deadline">
              締め切り
              <span class="text-muted small">(任意)</span>
            </label>
            <input
              id="work-deadline"
              v-model="creationForm.deadline"
              class="form-control"
              type="date"
              :min="creationForm.startDate || undefined"
              :disabled="isSubmitting || isSettingsLoading"
            />
          </div>

          <!-- 動的粒度フィールド -->
          <div v-for="(granularity, index) in sortedGranularities" :key="granularity.id" class="col-12 col-md-3">
            <label class="form-label" :for="`granularity-${granularity.id}`">
              {{ index === 0 ? '最上位' : `第${index + 1}階層` }}{{ granularity.label }}の数
            </label>
            <div class="input-group">
              <input
                v-if="index === 0"
                :id="`granularity-${granularity.id}`"
                v-model.number="topGranularityCount"
                :class="['form-control', attempted && granularityFieldErrors[granularity.id] ? 'is-invalid' : '']"
                type="number"
                min="1"
                :disabled="isSubmitting || isSettingsLoading || !!creationForm.structureString.trim()"
              />
              <input
                v-else
                :id="`granularity-${granularity.id}`"
                v-model.number="creationForm.granularityCounts[granularity.id]"
                :class="['form-control', attempted && granularityFieldErrors[granularity.id] ? 'is-invalid' : '']"
                type="number"
                min="1"
                :disabled="isSubmitting || isSettingsLoading || !!creationForm.structureString.trim()"
              />
              <span class="input-group-text">{{ granularity.label }}</span>
            </div>
            <div v-if="attempted && granularityFieldErrors[granularity.id]" class="invalid-feedback d-block">
              {{ granularityFieldErrors[granularity.id] }}
            </div>
          </div>

          <div class="col-12 col-md-3">
            <label class="form-label">推定総工数</label>
            <div class="form-control-plaintext h-100 d-flex align-items-center fw-semibold">{{ totalEstimatedHours.toFixed(2) }} h</div>
          </div>

          <!-- 区切り線 -->
          <div class="col-12">
            <hr class="my-3">
          </div>

          <!-- 文字列による構造指定 -->
          <div class="col-12">
            <label class="form-label" for="structure-string">
              文字列による構造指定
              <span class="text-muted small">(任意・上記の数値設定を無視)</span>
            </label>
            <textarea
              id="structure-string"
              v-model="creationForm.structureString"
              :class="['form-control', attempted && fieldErrors.structureString ? 'is-invalid' : '']"
              rows="3"
              placeholder="例: 4,2/2/2/2/2,2/2/2/2/2,4/4,2/2"
              :disabled="isSubmitting || isSettingsLoading"
            ></textarea>
            <div v-if="attempted && fieldErrors.structureString" class="invalid-feedback">
              {{ fieldErrors.structureString }}
            </div>
            <div class="form-text">
              <strong>書式:</strong><br>
              • 最上位ユニット：カンマ(,)区切りで分割<br>
              • 各最上位ユニット：角括弧[]で囲む<br>
              • 作業段階：スラッシュ(/)区切りで各最下位ユニットの作業段階を指定<br>
              • 最下位ユニット数：/で分割した数から自動計算<br>
              <strong>作業段階:</strong><br>
              • 1=未着手, 2=ネーム済, 3=下書済, 4=ペン入済, 5=仕上済<br>
              <strong>例:</strong><br>
              • 実例: <code>[1],[5/5/5/5/5],[5/5/5/4]</code><br>
              　→ 最上位1(1個未着手), 最上位2(5個仕上済), 最上位3(3個仕上済+1個ペン入済)<br>
              • 単純例: <code>[1/2/3],[2/1]</code><br>
              　→ 最上位1(未着手/ネーム済/下書済), 最上位2(ネーム済/未着手)
            </div>
          </div>
        </form>
      </div>
    </div>

    <section v-if="userId && (granularitiesLoaded || stageWorkloadsLoaded)">
      <div class="d-flex align-items-center justify-content-between mb-3">
        <h2 class="h5 fw-semibold mb-0">登録済みの作品</h2>
        <span class="badge text-bg-light">{{ works.length }} 件</span>
      </div>

      <div v-if="loadingWorks" class="alert alert-info" role="status">
        <div class="d-flex align-items-center">
          <div class="spinner-border spinner-border-sm me-2" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          作品一覧を読み込み中です...
        </div>
      </div>

      <div v-else-if="loadError" class="alert alert-danger" role="alert">{{ loadError }}</div>

      <div class="row g-4">
        <!-- 新規作成ボタン -->
        <div class="col-12 col-lg-6 col-xl-4">
          <div class="card h-100 shadow-sm border-2 border-dashed border-primary bg-light">
            <div class="card-body d-flex flex-column align-items-center justify-content-center text-center">
              <button
                type="button"
                class="btn btn-primary btn-lg"
                :disabled="isSubmitting || isSettingsLoading"
                @click="toggleCreateForm"
              >
                <i class="bi bi-plus-circle me-2"></i>
                新規作成
              </button>
              <p class="text-muted mt-3 mb-0 small">
                新しい作品を作成します
              </p>
            </div>
          </div>
        </div>

        <div v-for="work in sortedWorks" :key="work.id" class="col-12 col-lg-6 col-xl-4">
          <div class="card h-100 shadow-sm">
            <div class="card-body d-flex flex-column">
              <div class="d-flex justify-content-between align-items-start mb-2">
                <div>
                  <h3 class="h5 mb-1">{{ work.title }}</h3>
                  <p class="text-muted small mb-0">作成日: {{ formatDate(work.createdAt) }}</p>
                </div>
                <span class="badge text-bg-primary">{{ work.status }}</span>
              </div>

              <dl class="row g-2 small mb-4">
                <div class="col-6">
                  <dt class="text-muted">締め切り</dt>
                  <dd class="mb-0">{{ work.deadline ? formatDate(work.deadline) : '未設定' }}</dd>
                </div>
                <div class="col-6">
                  <dt class="text-muted">進捗率</dt>
                  <dd class="mb-0 fw-semibold">{{ computeWorkProgress(work) }}%</dd>
                </div>
                <div class="col-6">
                  <dt class="text-muted">ページ数</dt>
                  <dd class="mb-0">{{ work.units.length }}</dd>
                </div>
                <div class="col-6">
                  <dt class="text-muted">総コマ数</dt>
                  <dd class="mb-0">{{ totalPanelsForWork(work) }}</dd>
                </div>
                <div class="col-6">
                  <dt class="text-muted">推定総工数</dt>
                  <dd class="mb-0">{{ getWorkActualHours(work).totalEstimatedHours.toFixed(2) }} h</dd>
                </div>
                <div class="col-6">
                  <dt class="text-muted">推定残工数</dt>
                  <dd class="mb-0 text-warning">{{ getWorkActualHours(work).remainingEstimatedHours.toFixed(2) }} h</dd>
                </div>
                <div class="col-12"><hr class="my-1" /></div>
                <div class="col-6">
                  <dt class="text-muted">締切まで残り</dt>
                  <dd class="mb-0 fw-semibold">{{ getWorkMetrics(work).daysUntilDeadline.value }} 日</dd>
                </div>
                <div class="col-6">
                  <dt class="text-muted">残り作業可能時間</dt>
                  <dd class="mb-0 fw-semibold">{{ getWorkMetrics(work).availableWorkHours.value.toFixed(1) }} h</dd>
                </div>
                <div class="col-12">
                  <dt class="text-muted">1日の必要工数</dt>
                  <dd class="mb-0 fw-semibold" :class="{
                    'text-danger': getWorkMetrics(work).requiredDailyHours.value === Infinity || getWorkMetrics(work).requiredDailyHours.value > 12,
                    'text-warning': getWorkMetrics(work).requiredDailyHours.value > 8 && getWorkMetrics(work).requiredDailyHours.value <= 12,
                    'text-success': getWorkMetrics(work).requiredDailyHours.value <= 8
                  }">
                    {{ getWorkMetrics(work).requiredDailyHours.value === Infinity ? '不可能' : getWorkMetrics(work).requiredDailyHours.value.toFixed(2) + ' h' }}
                  </dd>
                </div>
              </dl>

              <button type="button" class="btn btn-outline-primary mt-auto" @click="navigateToDetail(work.id)">詳細を開く</button>
            </div>
          </div>
        </div>

        <!-- 作品が0件の場合のメッセージ -->
        <div v-if="sortedWorks.length === 0" class="col-12">
          <div class="alert alert-info text-center" role="status">
            <i class="bi bi-info-circle me-2"></i>
            現在登録されている作品はありません。新規作成ボタンから作品を作成してください。
          </div>
        </div>
      </div>
    </section>
  </section>
</template>
