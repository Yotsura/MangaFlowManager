import { computed } from "vue";
import { useRouter } from "vue-router";

import { useAuthStore } from "@/store/authStore";

export const useAuthGuard = () => {
  const router = useRouter();
  const authStore = useAuthStore();

  const isAuthenticated = computed(() => authStore.isAuthenticated);

  const requireAuth = async () => {
    await authStore.ensureInitialized();
    if (!authStore.isAuthenticated) {
      await router.push({ name: "login", query: { redirect: router.currentRoute.value.fullPath } });
    }
  };

  return { isAuthenticated, requireAuth };
};
