<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch, onActivated } from "vue";
import { storeToRefs } from "pinia";
import { useRouter } from "vue-router";

import { useAuthStore } from "@/store/authStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useWorksStore, WORK_STATUSES, type Work, type WorkStatus } from "@/store/worksStore";

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
});

const fieldErrors = reactive<Record<string, string | null>>({
  title: null,
  startDate: null,
  deadline: null,
});

const creationError = ref<string | null>(null);
const isSubmitting = ref(false);
const attempted = ref(false);

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

  if (!creationForm.deadline) {
    fieldErrors.deadline = "締め切りを入力してください。";
    hasError = true;
  }

  if (!creationForm.startDate) {
    fieldErrors.startDate = "開始日時を入力してください。";
    hasError = true;
  }

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

const handleCreate = () => {
  attempted.value = true;
  if (!validate()) {
    return;
  }

  if (!topGranularity.value) {
    return;
  }

  const startDate = creationForm.startDate || new Date().toISOString().slice(0, 10);
  const deadline = creationForm.deadline;

  isSubmitting.value = true;

  try {
    // 粒度に基づいてdefaultCountsを構築
    const defaultCounts = sortedGranularities.value.slice(1).map(granularity =>
      creationForm.granularityCounts[granularity.id] ?? 6
    );

    // 現在の設定をコピー
    const { workGranularities, workStageWorkloads } = copyCurrentSettings();

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

    // フォームをリセット
    creationForm.title = "";
    creationForm.startDate = new Date().toISOString().slice(0, 10);
    creationForm.deadline = "";
    creationForm.status = WORK_STATUSES[0];
    initializeGranularityForm();
    attempted.value = false;
    resetErrors();

    router.push({ name: "work-detail", params: { id: work.id } });
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

const navigateToDetail = (id: string) => {
  router.push({ name: "work-detail", params: { id } });
};
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

    <div v-else class="card shadow-sm mb-5">
      <div class="card-body">
        <div class="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3 mb-3">
          <div>
            <h2 class="h5 fw-semibold mb-1">新規作品を登録</h2>
            <p class="text-muted mb-0">タイトル・締め切り・粒度の数などを設定し、作品を作成します。</p>
          </div>
          <button type="button" class="btn btn-primary" :disabled="isSubmitting || isSettingsLoading" @click="handleCreate">作品を作成</button>
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
            <label class="form-label" for="work-deadline">締め切り</label>
            <input
              id="work-deadline"
              v-model="creationForm.deadline"
              :class="['form-control', attempted && fieldErrors.deadline ? 'is-invalid' : '']"
              type="date"
              :min="creationForm.startDate || undefined"
              :disabled="isSubmitting || isSettingsLoading"
            />
            <div v-if="attempted && fieldErrors.deadline" class="invalid-feedback">{{ fieldErrors.deadline }}</div>
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
                :disabled="isSubmitting || isSettingsLoading"
              />
              <input
                v-else
                :id="`granularity-${granularity.id}`"
                v-model.number="creationForm.granularityCounts[granularity.id]"
                :class="['form-control', attempted && granularityFieldErrors[granularity.id] ? 'is-invalid' : '']"
                type="number"
                min="1"
                :disabled="isSubmitting || isSettingsLoading"
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

      <div v-else-if="works.length === 0" class="alert alert-info" role="status">現在登録されている作品はありません。フォームから作品を作成してください。</div>

      <div v-else class="row g-4">
        <div v-for="work in works" :key="work.id" class="col-12 col-lg-6 col-xl-4">
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
                  <dd class="mb-0">{{ formatDate(work.deadline) }}</dd>
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
              </dl>

              <button type="button" class="btn btn-outline-primary mt-auto" @click="navigateToDetail(work.id)">詳細を開く</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </section>
</template>
