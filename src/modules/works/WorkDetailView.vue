<script setup lang="ts">
import { computed, onMounted, reactive, watch } from "vue";
import { storeToRefs } from "pinia";
import { useRoute, useRouter } from "vue-router";

import PagePanel from "./components/PagePanel.vue";
import ProgressHeatmap from "./components/ProgressHeatmap.vue";
import WorkSummaryCard from "./components/WorkSummaryCard.vue";

import { useAuthStore } from "@/store/authStore";
import { useSettingsStore } from "@/store/settingsStore";
import { WORK_STATUSES, useWorksStore, type WorkStatus } from "@/store/worksStore";

const route = useRoute();
const router = useRouter();
const workId = route.params.id as string;

const authStore = useAuthStore();
const settingsStore = useSettingsStore();
const worksStore = useWorksStore();

const { user } = storeToRefs(authStore);
const {
  granularities,
  granularitiesLoaded,
  loadingGranularities,
  stageWorkloads,
  stageWorkloadsLoaded,
  loadingStageWorkloads,
} = storeToRefs(settingsStore);

const work = computed(() => worksStore.getWorkById(workId));

const stageLabels = computed(() => stageWorkloads.value.map((stage) => stage.label));
const stageCount = computed(() => stageLabels.value.length);

const primaryGranularityLabel = computed(() => {
  const id = work.value?.primaryGranularityId;
  if (!id) {
    return null;
  }
  return granularities.value.find((item) => item.id === id)?.label ?? null;
});

const userId = computed(() => user.value?.uid ?? null);

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

onMounted(async () => {
  await authStore.ensureInitialized();
  await ensureSettingsLoaded();
});

watch(userId, async (next, prev) => {
  if (next && next !== prev) {
    await ensureSettingsLoaded();
  }
});

const detailForm = reactive({
  title: "",
  status: WORK_STATUSES[0] as WorkStatus,
  startDate: "",
  deadline: "",
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
  },
  { immediate: true },
);

watch(
  () => detailForm.title,
  (value) => {
    if (work.value && value !== work.value.title) {
      worksStore.updateWork(work.value.id, { title: value });
    }
  },
);

watch(
  () => detailForm.status,
  (value) => {
    if (work.value && value !== work.value.status) {
      worksStore.updateWork(work.value.id, { status: value });
    }
  },
);

watch(
  () => detailForm.startDate,
  (value) => {
    if (work.value && value !== work.value.startDate) {
      worksStore.updateWork(work.value.id, { startDate: value });
    }
  },
);

watch(
  () => detailForm.deadline,
  (value) => {
    if (work.value && value !== work.value.deadline) {
      worksStore.updateWork(work.value.id, { deadline: value });
    }
  },
);

const overallProgress = computed(() => {
  if (!work.value || stageCount.value === 0 || work.value.pages.length === 0) {
    return 0;
  }

  const denominator = stageCount.value;
  const total = work.value.pages.reduce((acc, page) => {
    const ratio = Math.min(page.stageIndex + 1, denominator) / denominator;
    return acc + ratio;
  }, 0);
  return Math.round((total / work.value.pages.length) * 100);
});

const totalPanels = computed(() => work.value?.pages.reduce((sum, page) => sum + page.panelCount, 0) ?? 0);

const advanceStage = (pageId: string) => {
  worksStore.advancePageStage(workId, pageId, stageCount.value);
};

const updatePanelCount = (payload: { pageId: string; panelCount: number }) => {
  worksStore.setPagePanelCount(workId, payload.pageId, payload.panelCount);
};

const movePage = (payload: { pageId: string; position: string }) => {
  if (payload.position === payload.pageId) {
    return;
  }

  let afterPageId: string | null;

  if (payload.position === "__start") {
    afterPageId = null;
  } else if (payload.position === "__end") {
    afterPageId = "__end";
  } else {
    afterPageId = payload.position;
  }

  worksStore.movePage({
    workId,
    pageId: payload.pageId,
    afterPageId: afterPageId === "__end" ? "" : afterPageId,
  });
};

const addPage = () => {
  worksStore.addPage(workId);
};

const removePage = (pageId: string) => {
  worksStore.removePage({ workId, pageId });
};

const requestWorkDeletion = () => {
  if (!work.value) {
    return;
  }

  const confirmed = window.confirm(`作品「${work.value.title || "無題"}」を本当に削除しますか？`);
  if (!confirmed) {
    return;
  }

  worksStore.removeWork({ workId: work.value.id });
  router.push({ name: "works" });
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
          <p class="mb-0 text-muted small">最上位粒度: <strong>{{ primaryGranularityLabel ?? "未設定" }}</strong></p>
          <p class="mb-0 text-muted small">ページ数: <strong>{{ work.pages.length }}</strong> / 総コマ数: <strong>{{ totalPanels }}</strong></p>
        </div>
      </header>

      <div class="row g-4 mb-4">
        <div class="col-12">
          <div class="card shadow-sm">
            <div class="card-body">
              <div class="row g-3">
                <div class="col-12 col-md-6 col-xl-4">
                  <label class="form-label" for="detail-title">タイトル</label>
                  <input id="detail-title" v-model="detailForm.title" type="text" class="form-control" placeholder="作品タイトル" />
                </div>
                <div class="col-12 col-md-3 col-xl-2">
                  <label class="form-label" for="detail-status">ステータス</label>
                  <select id="detail-status" v-model="detailForm.status" class="form-select">
                    <option v-for="option in WORK_STATUSES" :key="option" :value="option">{{ option }}</option>
                  </select>
                </div>
                <div class="col-12 col-md-3 col-xl-2">
                  <label class="form-label" for="detail-start">開始日</label>
                  <input id="detail-start" v-model="detailForm.startDate" type="date" class="form-control" :max="detailForm.deadline || undefined" />
                </div>
                <div class="col-12 col-md-3 col-xl-2">
                  <label class="form-label" for="detail-deadline">締め切り</label>
                  <input id="detail-deadline" v-model="detailForm.deadline" type="date" class="form-control" :min="detailForm.startDate || undefined" />
                </div>
                <div class="col-12 col-md-6 col-xl-2">
                  <label class="form-label">推定総工数</label>
                  <div class="form-control-plaintext fw-semibold">{{ work.totalEstimatedHours.toFixed(2) }} h</div>
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
              <div class="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h2 class="h5 mb-1">ページ進行状況</h2>
                  <p class="text-muted mb-0">カードをクリックすると次の作業段階へ進みます。</p>
                </div>
                <button type="button" class="btn btn-outline-primary" @click="addPage">ページを追加</button>
              </div>

              <PagePanel
                :pages="work.pages"
                :stage-labels="stageLabels"
                :stage-count="stageCount"
                :default-panels="work.defaultPanelsPerPage"
                @advance="advanceStage"
                @update-panel="updatePanelCount"
                @move-page="movePage"
                @remove-page="removePage"
                @add-page="addPage"
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
                @request-delete="requestWorkDeletion"
              />
            </div>
          </div>

          <div class="card shadow-sm">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <h2 class="h5 mb-0">進捗ヒートマップ</h2>
                <span class="badge text-bg-light">更新: {{ formatDate(work.updatedAt) }}</span>
              </div>
              <ProgressHeatmap :pages="work.pages" :stage-count="stageCount" :stage-labels="stageLabels" />
            </div>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>
