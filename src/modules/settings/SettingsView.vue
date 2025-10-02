<script setup lang="ts">
// TODO: 設定フォームの状態管理と保存処理を実装

import GranularityTable from "./components/GranularityTable.vue";
import StageWorkloadEditor from "./components/StageWorkloadEditor.vue";
import WorkHoursForm from "./components/WorkHoursForm.vue";
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
            <h2 class="h5 mb-3">作業可能時間の設定</h2>
            <WorkHoursForm />
          </div>
        </div>
      </div>

      <div class="col-12 col-lg-6">
        <div class="card shadow-sm h-100">
          <div class="card-body">
            <h2 class="h5 mb-3">作業粒度の設定</h2>
            <GranularityTable />
          </div>
        </div>
      </div>

      <div class="col-12">
        <div class="card shadow-sm">
          <div class="card-body">
            <h2 class="h5 mb-3">作業工数の設定</h2>
            <StageWorkloadEditor />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
