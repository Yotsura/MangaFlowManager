<script setup lang="ts">
import { ref } from "vue";
import { storeToRefs } from "pinia";
import { useAuthStore } from "@/store/authStore";
import WorkloadSettingsEditor from "@/components/common/WorkloadSettingsEditor.vue";

interface WorkloadSettingsEditorExposed {
  save: () => Promise<void>;
  isSaving: () => boolean;
  canSave: () => boolean;
  hasChanges: () => boolean;
  resetChanges: () => void;
}

const authStore = useAuthStore();
const { user } = storeToRefs(authStore);

const workloadSettingsRef = ref<WorkloadSettingsEditorExposed | null>(null);

const handleSettingsSaved = () => {
  console.log('設定が保存されました');
};

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
      <p class="text-muted">作業粒度と工数設定を管理します。作業可能時間の設定はカレンダー画面で行えます。</p>
    </div>

    <!-- 統合設定エディター -->
    <WorkloadSettingsEditor
      ref="workloadSettingsRef"
      @settings-saved="handleSettingsSaved"
    />

    <!-- 祝日データ管理 -->
    <div class="row g-3 mt-4">
      <div class="col-12">
        <div class="card shadow-sm">
          <div class="card-header">
            <h6 class="mb-0">祝日データ管理</h6>
          </div>
          <div class="card-body">
            <p class="text-muted mb-3">
              祝日データは内閣府の公式データから自動取得されます。<br>
              手動で最新データを取得する場合は下記ボタンを使用してください。
            </p>
            <button
              type="button"
              class="btn btn-outline-info"
              @click="updateHolidaysGlobally"
            >
              <i class="bi bi-arrow-clockwise me-1"></i>
              祝日データ更新
            </button>
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
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
