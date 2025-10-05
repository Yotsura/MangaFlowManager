<script setup lang="ts">
// TODO: 設定フォームの状態管理と保存処理を実装

import { computed, ref, watch } from "vue";
import { storeToRefs } from "pinia";

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

// 祝日データ管理
const holidayUpdating = ref(false);
const holidayLastUpdated = ref<Date | null>(null);

const updateHolidays = async () => {
  holidayUpdating.value = true;
  try {
    const { globalHolidayService } = await import('@/services/globalHolidayService');
    await globalHolidayService.forceUpdate();
    holidayLastUpdated.value = new Date();
    console.log('祝日データを更新しました');
  } catch (error) {
    console.error('祝日データの更新に失敗しました:', error);
  } finally {
    holidayUpdating.value = false;
  }
};

const checkHolidayStatus = async () => {
  try {
    const { globalHolidayService } = await import('@/services/globalHolidayService');
    const holidays = await globalHolidayService.getHolidays();
    if (holidays.length > 0) {
      // 最新の祝日から更新日時を推定
      holidayLastUpdated.value = new Date();
    }
  } catch (error) {
    console.warn('祝日データの状態確認に失敗しました:', error);
  }
};

// 初期化時に祝日状態をチェック
checkHolidayStatus();

// デバッグ情報
import { useAuthStore } from '@/store/authStore';
const authStore = useAuthStore();
const { user, isAuthenticated } = storeToRefs(authStore);

// 認証状態をログ出力
watch([user, isAuthenticated], ([newUser, newAuth]) => {
  console.log('認証状態変更:', {
    user: newUser?.uid || 'なし',
    email: newUser?.email || 'なし',
    authenticated: newAuth,
    timestamp: new Date().toISOString()
  });
}, { immediate: true });

// 設定保存のテスト関数
const testSettingsSave = async () => {
  if (!user.value?.uid) {
    console.error('ユーザーが認証されていません');
    return;
  }

  console.log('設定保存テスト開始');
  const testData = {
    workHours: [{ day: 'monday', start: '09:00', end: '17:00' }]
  };

  try {
    const path = `users/${user.value.uid}/settings/workHours`;
    const { setDocument } = await import('@/services/firebase/firestoreService');
    await setDocument(path, testData);
    console.log('テスト保存成功');
    alert('設定保存テスト成功！');
  } catch (error) {
    console.error('テスト保存失敗:', error);
    alert('設定保存テスト失敗: ' + (error instanceof Error ? error.message : String(error)));
  }
};

// 祝日データ更新テスト関数
const updateHolidaysGlobally = async () => {
  console.log('祝日データ更新テスト開始');
  try {
    const { globalHolidayService } = await import('@/services/globalHolidayService');
    await globalHolidayService.forceUpdate();
    console.log('祝日データ更新成功');
    alert('祝日データ更新完了！');
  } catch (error) {
    console.error('祝日データ更新失敗:', error);
    alert('祝日データ更新失敗: ' + (error instanceof Error ? error.message : String(error)));
  }
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

      <!-- 祝日データ管理 -->
      <div class="col-12">
        <div class="card shadow-sm">
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
              <div>
                <h2 class="h5 mb-1">祝日データ管理</h2>
                <p class="text-muted small mb-0">
                  内閣府の祝日データをFirestoreで全ユーザー共通管理
                  <span v-if="holidayLastUpdated" class="ms-2">
                    (最終確認: {{ holidayLastUpdated.toLocaleString() }})
                  </span>
                </p>
              </div>
              <button
                class="btn btn-outline-primary"
                type="button"
                :disabled="holidayUpdating"
                @click="updateHolidays"
              >
                <i class="bi bi-arrow-clockwise me-1"></i>
                {{ holidayUpdating ? "更新中..." : "祝日データ更新" }}
              </button>
            </div>

            <div class="alert alert-info">
              <i class="bi bi-info-circle me-2"></i>
              祝日データは月1回自動更新されます。手動更新は内閣府の最新データを即座に取得します。
            </div>

            <!-- 設定保存テスト用 -->
            <div class="mt-3">
              <h6 class="text-muted">設定保存テスト</h6>
              <div class="d-flex gap-2">
                <button
                  class="btn btn-sm btn-outline-success"
                  @click="saveWorkHours"
                  :disabled="workHoursSaving"
                >
                  作業時間保存テスト
                </button>
                <button
                  class="btn btn-sm btn-outline-success"
                  @click="saveGranularities"
                  :disabled="granularitySaving"
                >
                  粒度保存テスト
                </button>
                <button
                  class="btn btn-sm btn-outline-success"
                  @click="saveStageWorkloads"
                  :disabled="stageSaving"
                >
                  工数保存テスト
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- デバッグセクション -->
    <div class="row g-3 mt-3">
      <div class="col-12">
        <div class="card shadow-sm">
          <div class="card-header">
            <h6 class="mb-0">デバッグ機能</h6>
          </div>
          <div class="card-body">
            <button type="button" class="btn btn-outline-warning me-2" @click="testSettingsSave">
              設定保存テスト
            </button>
            <button type="button" class="btn btn-outline-info" @click="updateHolidaysGlobally">
              祝日データ更新
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
