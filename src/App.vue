<script setup lang="ts">
import { computed, onMounted } from "vue";
import { storeToRefs } from "pinia";
import { RouterView, useRoute } from "vue-router";

import AppNavbar from "@/components/AppNavbar.vue";
import AuthLayout from "@/layouts/AuthLayout.vue";
import DefaultLayout from "@/layouts/DefaultLayout.vue";
import { useAuthStore } from "@/store/authStore";

type LayoutKey = "default" | "auth";

const authStore = useAuthStore();
const { initializing, isAuthenticated } = storeToRefs(authStore);
const route = useRoute();

const layoutKey = computed<LayoutKey>(() => (route.meta?.layout as LayoutKey) || "default");
const layoutComponent = computed(() => (layoutKey.value === "auth" ? AuthLayout : DefaultLayout));

// 検索エンジン対策のメタタグを動的に設定
onMounted(() => {
  // 既存のrobotsメタタグがない場合のみ追加
  if (!document.querySelector('meta[name="robots"]')) {
    const robotsMeta = document.createElement('meta');
    robotsMeta.name = 'robots';
    robotsMeta.content = 'noindex, nofollow, noarchive, nosnippet, noimageindex, nocache';
    document.head.appendChild(robotsMeta);
  }

  // GoogleBotメタタグ
  if (!document.querySelector('meta[name="googlebot"]')) {
    const googlebotMeta = document.createElement('meta');
    googlebotMeta.name = 'googlebot';
    googlebotMeta.content = 'noindex, nofollow, noarchive, nosnippet, noimageindex';
    document.head.appendChild(googlebotMeta);
  }

  // BingBotメタタグ
  if (!document.querySelector('meta[name="bingbot"]')) {
    const bingbotMeta = document.createElement('meta');
    bingbotMeta.name = 'bingbot';
    bingbotMeta.content = 'noindex, nofollow, noarchive, nosnippet, noimageindex';
    document.head.appendChild(bingbotMeta);
  }
});
</script>

<template>
  <RouterView v-slot="{ Component }">
    <component :is="layoutComponent" class="app">
      <template v-if="layoutKey === 'default'" #header>
        <!-- ナビゲーションバー -->
        <AppNavbar v-if="isAuthenticated" />
      </template>

      <template v-if="layoutKey === 'default'" #footer>
        <footer class="bg-light py-3 mt-auto border-top">
          <div class="container text-center text-muted small">© {{ new Date().getFullYear() }} Manga Flow Manager</div>
        </footer>
      </template>

      <div v-if="initializing" class="py-5 text-center">
        <div class="spinner-border text-primary mb-3" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="text-muted">認証状態を確認しています...</p>
      </div>

      <div v-else-if="!Component" class="py-5 text-center">
        <p class="text-danger">コンポーネントが読み込まれませんでした</p>
        <p class="text-muted">ルート: {{ route.path }}</p>
      </div>

      <component :is="Component" v-else />
    </component>
  </RouterView>
</template>

<style>
/* グローバルスタイル: ナビゲーションバーに対応したレイアウト */
@media (min-width: 992px) {
  .default-layout main {
    margin-left: 240px;
    transition: margin-left 0.3s ease;
  }

  /* AppNavbarがcollapsedクラスを持つ場合 */
  body:has(.app-navbar.collapsed) .default-layout main {
    margin-left: 70px;
  }

  .default-layout footer {
    margin-left: 240px;
    transition: margin-left 0.3s ease;
  }

  body:has(.app-navbar.collapsed) .default-layout footer {
    margin-left: 70px;
  }
}

@media (max-width: 991.98px) {
  .default-layout main {
    padding-bottom: 1rem;
  }
}
</style>

<style scoped>
/* デスクトップ時: パディングは不要（ナビゲーションが上から表示） */
@media (min-width: 992px) {
  :deep(.default-layout) {
    padding-top: 0;
  }
}

/* スマホ時: 下部ナビゲーションのための余白 */
@media (max-width: 991.98px) {
  :deep(.default-layout) {
    padding-top: 0;
    padding-bottom: 65px;
  }
}
</style>
