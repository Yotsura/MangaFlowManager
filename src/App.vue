<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";

import AuthLayout from "@/layouts/AuthLayout.vue";
import DefaultLayout from "@/layouts/DefaultLayout.vue";
import { useAuthStore } from "@/store/authStore";

type LayoutKey = "default" | "auth";

const authStore = useAuthStore();
const { initializing, isAuthenticated, displayName } = storeToRefs(authStore);
const route = useRoute();
const router = useRouter();

const layoutKey = computed<LayoutKey>(() => (route.meta?.layout as LayoutKey) || "default");
const layoutComponent = computed(() => (layoutKey.value === "auth" ? AuthLayout : DefaultLayout));

const handleLogout = async () => {
  try {
    await authStore.logout();
    if (route.name !== "login") {
      await router.push({ name: "login" });
    }
  } catch (error) {
    console.error(error);
  }
};
</script>

<template>
  <RouterView v-slot="{ Component }">
    <component :is="layoutComponent" class="app">
      <template v-if="layoutKey === 'default'" #header>
        <header class="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm">
          <div class="container-fluid">
            <RouterLink class="navbar-brand" to="/">Manga Flow Manager</RouterLink>

            <button
              class="navbar-toggler"
              type="button"
              data-bs-toggle="collapse"
              data-bs-target="#navbarSupportedContent"
              aria-controls="navbarSupportedContent"
              aria-expanded="false"
              aria-label="Toggle navigation"
            >
              <span class="navbar-toggler-icon"></span>
            </button>

            <div class="collapse navbar-collapse" id="navbarSupportedContent">
              <ul class="navbar-nav me-auto mb-2 mb-lg-0" v-if="isAuthenticated">
                <li class="nav-item">
                  <RouterLink class="nav-link" to="/">ホーム</RouterLink>
                </li>
                <li class="nav-item">
                  <RouterLink class="nav-link" to="/calendar">カレンダー</RouterLink>
                </li>
                <li class="nav-item">
                  <RouterLink class="nav-link" to="/works">作品管理</RouterLink>
                </li>
                <li class="nav-item">
                  <RouterLink class="nav-link" to="/settings">設定</RouterLink>
                </li>
                <li class="nav-item">
                  <RouterLink class="nav-link" to="/about">アプリについて</RouterLink>
                </li>
              </ul>

              <div class="d-flex align-items-center gap-3 ms-auto">
                <div v-if="isAuthenticated" class="text-end text-light small">
                  <span class="d-block">{{ displayName || "ログイン中" }}</span>
                </div>

                <button v-if="isAuthenticated" type="button" class="btn btn-outline-light btn-sm" @click="handleLogout">
                  ログアウト
                </button>
              </div>
            </div>
          </div>
        </header>
      </template>

      <template v-if="layoutKey === 'default'" #footer>
        <footer class="bg-light py-3 mt-auto border-top">
          <div class="container text-center text-muted small">© {{ new Date().getFullYear() }} Manga Flow Manager</div>
        </footer>
      </template>

      <section v-if="initializing" class="py-5 text-center">
        <div class="spinner-border text-primary mb-3" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="text-muted">認証状態を確認しています...</p>
      </section>

      <component :is="Component" v-else />
    </component>
  </RouterView>
</template>
