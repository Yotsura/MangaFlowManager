<script setup lang="ts">
import { storeToRefs } from "pinia";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";

import { useAuthStore } from "@/stores/auth";

const authStore = useAuthStore();
const { initializing, isAuthenticated, displayName } = storeToRefs(authStore);
const route = useRoute();
const router = useRouter();

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

const isLoginRoute = () => route.name === "login";
</script>

<template>
  <div class="app d-flex flex-column min-vh-100">
    <header class="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm">
      <div class="container-fluid">
        <RouterLink class="navbar-brand" to="/">MangaFlow Manager</RouterLink>

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
              <RouterLink class="nav-link" to="/about">アプリについて</RouterLink>
            </li>
          </ul>

          <div class="d-flex align-items-center gap-3 ms-auto">
            <div v-if="isAuthenticated" class="text-end text-light small">
              <span class="d-block">{{ displayName || "ログイン中" }}</span>
            </div>

            <button v-if="isAuthenticated" type="button" class="btn btn-outline-light btn-sm" @click="handleLogout">ログアウト</button>

            <RouterLink v-else-if="!isLoginRoute()" class="btn btn-outline-light btn-sm" to="/login"> ログイン </RouterLink>
          </div>
        </div>
      </div>
    </header>

    <main class="flex-fill">
      <section v-if="initializing" class="py-5 text-center">
        <div class="spinner-border text-primary mb-3" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="text-muted">認証状態を確認しています...</p>
      </section>

      <RouterView v-else />
    </main>

    <footer class="bg-light py-3 mt-auto border-top">
      <div class="container text-center text-muted small">© {{ new Date().getFullYear() }} MangaFlow Manager</div>
    </footer>
  </div>
</template>

<style scoped>
.app {
  background-color: #f8f9fa;
}

@media (min-width: 992px) {
  .navbar .navbar-nav .nav-link {
    padding-left: 1rem;
    padding-right: 1rem;
  }
}
</style>
