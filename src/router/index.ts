import { createRouter, createWebHistory } from "vue-router";

import { useAuthStore } from "@/stores/auth";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/login",
      name: "login",
      component: () => import("@/views/LoginView.vue"),
      meta: { guestOnly: true },
    },
    {
      path: "/",
      name: "home",
      component: () => import("@/views/HomeView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/about",
      name: "about",
      component: () => import("@/views/AboutView.vue"),
      meta: { requiresAuth: true },
    },
  ],
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore();
  await authStore.ensureInitialized();

  if (to.meta?.requiresAuth && !authStore.isAuthenticated) {
    return {
      name: "login",
      query: to.fullPath !== "/" ? { redirect: to.fullPath } : undefined,
    };
  }

  if (to.meta?.guestOnly && authStore.isAuthenticated) {
    return { name: "home" };
  }

  return true;
});

export default router;
