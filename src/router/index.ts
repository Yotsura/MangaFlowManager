import { createRouter, createWebHistory } from "vue-router";

import { useAuthStore } from "@/store/authStore";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/login",
      name: "login",
      component: () => import("@/modules/auth/LoginView.vue"),
      meta: { guestOnly: true, layout: "auth" },
    },
    {
      path: "/",
      name: "home",
      component: () => import("@/modules/home/HomeView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/calendar",
      name: "calendar",
      component: () => import("@/modules/calendar/CalendarView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/works",
      name: "works",
      component: () => import("@/modules/works/WorksListView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/works/:id",
      name: "work-detail",
      component: () => import("@/modules/works/WorkDetailView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/settings",
      name: "settings",
      component: () => import("@/modules/settings/SettingsView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/about",
      name: "about",
      component: () => import("@/modules/about/AboutView.vue"),
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
