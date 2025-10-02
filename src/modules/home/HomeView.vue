<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useAuthStore } from "@/store/authStore";

const authStore = useAuthStore();
const { displayName } = storeToRefs(authStore);
</script>

<template>
  <section class="container py-5">
    <div class="mb-4">
      <h1 class="h2 fw-semibold">
        ようこそ<span v-if="displayName">、{{ displayName }}</span>！
      </h1>
      <p class="text-muted">Manga Flow Manager のダッシュボードです。</p>
    </div>

    <div class="row g-3">
      <div class="col-12 col-md-6 col-xl-4">
        <div class="card shadow-sm h-100">
          <div class="card-body">
            <h2 class="card-title h5">最近の作品</h2>
            <p class="card-text text-muted">最近更新した作品や下書きがここに表示されます。</p>
            <button type="button" class="btn btn-primary" disabled>作品を追加</button>
          </div>
        </div>
      </div>

      <div class="col-12 col-md-6 col-xl-4">
        <div class="card shadow-sm h-100">
          <div class="card-body">
            <h2 class="card-title h5">進行中のタスク</h2>
            <p class="card-text text-muted">進捗中のタスクやToDoがここに表示されます。</p>
            <button type="button" class="btn btn-outline-secondary" disabled>タスクを管理</button>
          </div>
        </div>
      </div>

      <div class="col-12 col-md-6 col-xl-4">
        <div class="card shadow-sm h-100">
          <div class="card-body">
            <h2 class="card-title h5">通知</h2>
            <p class="card-text text-muted">新着通知やお知らせがここに表示されます。</p>
            <button type="button" class="btn btn-outline-secondary" disabled>通知センターを見る</button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
