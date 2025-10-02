<script setup lang="ts">
import { storeToRefs } from "pinia";

import { useAuthStore } from "@/stores/auth";

const authStore = useAuthStore();
const { displayName } = storeToRefs(authStore);
</script>

<template>
  <div class="container py-4">
    <div class="row g-4">
      <div class="col-12">
        <div class="card shadow-sm border-0">
          <div class="card-body">
            <h1 class="h4 mb-2">ようこそ、{{ displayName || "ユーザー" }} さん</h1>
            <p class="text-muted mb-0">
              ここから作品の進捗や作業スケジュールを管理できます。
              メニューから各機能にアクセスしてください。
            </p>
          </div>
        </div>
      </div>

      <div class="col-12 col-lg-6">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body">
            <h2 class="h5 mb-3">次のステップ</h2>
            <ul class="list-unstyled mb-0">
              <li class="d-flex align-items-start mb-2">
                <span class="badge bg-primary me-2">1</span>
                作品を登録して締切と工数を設定しましょう。
              </li>
              <li class="d-flex align-items-start mb-2">
                <span class="badge bg-primary me-2">2</span>
                カレンダーで作業不可時間を設定し、実行可能なプランを確認しましょう。
              </li>
              <li class="d-flex align-items-start">
                <span class="badge bg-primary me-2">3</span>
                ページごとの進捗を更新して、ステータスを可視化しましょう。
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div class="col-12 col-lg-6">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body">
            <h2 class="h5 mb-3">お知らせ</h2>
            <p class="text-muted mb-0">
              まだ機能は準備中です。今後、作品管理やカレンダー画面を追加予定です。
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
