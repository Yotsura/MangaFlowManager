<script setup lang="ts">
import { useRoute } from "vue-router";

import PagePanel from "./components/PagePanel.vue";
import ProgressHeatmap from "./components/ProgressHeatmap.vue";
import WorkSummaryCard from "./components/WorkSummaryCard.vue";

const route = useRoute();
const workId = route.params.id as string;
</script>

<template>
  <section class="container py-5">
    <div class="mb-4">
      <h1 class="h3 fw-semibold">作品詳細</h1>
      <p class="text-muted">ID: {{ workId }}</p>
    </div>

    <div class="row g-3">
      <div class="col-12 col-lg-8">
        <div class="card shadow-sm">
          <div class="card-body">
            <h2 class="h5 mb-3">ページ進行状況</h2>
            <p class="text-muted">ページパネルを用いた進捗管理を実装予定です。</p>
            <PagePanel />
          </div>
        </div>
      </div>

      <div class="col-12 col-lg-4">
        <div class="card shadow-sm">
          <div class="card-body">
            <h2 class="h5 mb-3">作品概要</h2>
            <WorkSummaryCard />
          </div>
        </div>

        <div class="card shadow-sm mt-3">
          <div class="card-body">
            <h2 class="h5 mb-3">進捗ヒートマップ</h2>
            <ProgressHeatmap />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
