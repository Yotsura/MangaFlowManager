<script setup lang="ts">
// TODO: 作品一覧の取得と表示ロジックを実装
</script>

<template>
  <section class="container py-5">
    <div class="d-flex align-items-center justify-content-between mb-4">
      <div>
        <h1 class="h3 fw-semibold">作品一覧</h1>
        <p class="text-muted">登録済みの作品を一覧表示し、新規作成や詳細へ遷移できます。</p>
      </div>
      <button type="button" class="btn btn-primary" disabled>作品を追加</button>
    </div>

    <div class="alert alert-secondary">
      作品データの管理機能は今後実装予定です。Firestore との連携を予定しています。
    </div>
  </section>
</template>
