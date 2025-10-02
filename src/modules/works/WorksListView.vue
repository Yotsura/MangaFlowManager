<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
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
  totalUnits: 6,
  defaultPanels: 6,
  startDate: new Date().toISOString().slice(0, 10),
  deadline: "",
});

const fieldErrors = reactive<Record<string, string | null>>({
  title: null,
  totalUnits: null,
  defaultPanels: null,
  startDate: null,
  deadline: null,
});

const creationError = ref<string | null>(null);
const isSubmitting = ref(false);
const attempted = ref(false);

const topGranularity = computed(() => {
  if (granularities.value.length === 0) {
    return null;
  }
  const sorted = [...granularities.value].sort((a, b) => b.weight - a.weight);
  return sorted[0] ?? null;
});

const stageLabels = computed(() => stageWorkloads.value.map((stage) => stage.label));
const stageCount = computed(() => stageLabels.value.length);

const unitEstimatedHours = computed(() => {
  const primary = topGranularity.value;
  if (!primary) {
    return 0;
  }

  return stageWorkloads.value.reduce((total, stage) => {
    const entry = stage.entries.find((item) => item.granularityId === primary.id);
    if (!entry || entry.hours === null || Number.isNaN(Number(entry.hours))) {
      return total;
    }
    return total + Number(entry.hours);
  }, 0);
});

const totalEstimatedHours = computed(() => Number((creationForm.totalUnits * unitEstimatedHours.value).toFixed(2)));

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

onMounted(async () => {
  await authStore.ensureInitialized();
  await ensureSettingsLoaded();
  await ensureWorksLoaded();
});

watch(userId, async (next, prev) => {
  if (next && next !== prev) {
    await ensureSettingsLoaded();
    await worksStore.fetchWorks(next);
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

  if (!Number.isFinite(creationForm.totalUnits) || creationForm.totalUnits <= 0) {
    fieldErrors.totalUnits = "最上位粒度の数は1以上で入力してください。";
    hasError = true;
  }

  if (!Number.isFinite(creationForm.defaultPanels) || creationForm.defaultPanels <= 0) {
    fieldErrors.defaultPanels = "デフォルトコマ数は1以上で入力してください。";
    hasError = true;
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
    const work = worksStore.createWork({
      title: creationForm.title,
      status: creationForm.status,
      startDate,
      deadline,
      totalUnits: creationForm.totalUnits,
      defaultPanelsPerPage: creationForm.defaultPanels,
      primaryGranularityId: topGranularity.value.id,
      unitEstimatedHours: unitEstimatedHours.value,
    });

    creationForm.title = "";
    creationForm.totalUnits = 6;
    creationForm.defaultPanels = 6;
    creationForm.startDate = new Date().toISOString().slice(0, 10);
    creationForm.deadline = "";
    creationForm.status = WORK_STATUSES[0];
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

const computeWorkProgress = (work: Work) => {
  // 簡略化: totalUnitsと総進捗から計算
  if (!work.totalUnits || stageCount.value === 0) {
    return 0;
  }

  // 暫定: 50%の進捗として表示（実際の計算は後で実装）
  return 50;
};

const totalPanelsForWork = (work: Work) => work.totalUnits;

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

    <div v-if="settingsError" class="alert alert-danger" role="alert">設定を読み込めませんでした: {{ settingsError }}</div>

    <div class="card shadow-sm mb-5">
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

          <div class="col-12 col-md-3">
            <label class="form-label" for="work-units">最上位粒度の数</label>
            <div class="input-group">
              <input
                id="work-units"
                v-model.number="creationForm.totalUnits"
                :class="['form-control', attempted && fieldErrors.totalUnits ? 'is-invalid' : '']"
                type="number"
                min="1"
                :disabled="isSubmitting || isSettingsLoading"
              />
              <span class="input-group-text">{{ topGranularity?.label ?? "単位" }}</span>
            </div>
            <div v-if="attempted && fieldErrors.totalUnits" class="invalid-feedback d-block">{{ fieldErrors.totalUnits }}</div>
          </div>

          <div class="col-12 col-md-3">
            <label class="form-label" for="work-panels">デフォルトコマ数</label>
            <input
              id="work-panels"
              v-model.number="creationForm.defaultPanels"
              :class="['form-control', attempted && fieldErrors.defaultPanels ? 'is-invalid' : '']"
              type="number"
              min="1"
              :disabled="isSubmitting || isSettingsLoading"
            />
            <div v-if="attempted && fieldErrors.defaultPanels" class="invalid-feedback">{{ fieldErrors.defaultPanels }}</div>
          </div>

          <div class="col-12 col-md-3">
            <label class="form-label">推定総工数</label>
            <div class="form-control-plaintext h-100 d-flex align-items-center fw-semibold">{{ totalEstimatedHours.toFixed(2) }} h</div>
          </div>
        </form>
      </div>
    </div>

    <section>
      <div class="d-flex align-items-center justify-content-between mb-3">
        <h2 class="h5 fw-semibold mb-0">登録済みの作品</h2>
        <span class="badge text-bg-light">{{ works.length }} 件</span>
      </div>

      <div v-if="loadingWorks" class="alert alert-info" role="status">作品一覧を読み込み中です...</div>

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
                <div class="col-12">
                  <dt class="text-muted">推定総工数</dt>
                  <dd class="mb-0">{{ work.totalEstimatedHours.toFixed(2) }} h</dd>
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
