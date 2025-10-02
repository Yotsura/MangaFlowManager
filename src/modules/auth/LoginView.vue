<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { storeToRefs } from "pinia";

import { useAuthStore } from "@/store/authStore";

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const { pending, lastError, preferredMode } = storeToRefs(authStore);

const form = reactive({
  email: "",
  password: "",
  confirmPassword: "",
});

const localError = ref<string | null>(null);
const redirectPath = computed(() => {
  const redirect = route.query.redirect;
  return typeof redirect === "string" && redirect.startsWith("/") ? redirect : undefined;
});

const isRegisterMode = computed(() => preferredMode.value === "register");

const navigateAfterAuth = async () => {
  await router.replace(redirectPath.value || "/");
};

watch(
  () => authStore.isAuthenticated,
  async (isAuthenticated) => {
    if (isAuthenticated) {
      await navigateAfterAuth();
    }
  },
  { immediate: true },
);

watch(preferredMode, () => {
  form.password = "";
  form.confirmPassword = "";
  localError.value = null;
});

const submit = async () => {
  localError.value = null;

  if (isRegisterMode.value && form.password !== form.confirmPassword) {
    localError.value = "パスワードが一致しません。";
    return;
  }

  try {
    if (isRegisterMode.value) {
      await authStore.registerWithEmailAndPassword(form.email, form.password);
    } else {
      await authStore.loginWithEmail(form.email, form.password);
    }

    await navigateAfterAuth();
  } catch (error) {
    console.error(error);
  }
};

const handleGoogleSignIn = async () => {
  localError.value = null;
  try {
    await authStore.loginWithGoogleProvider();
    await navigateAfterAuth();
  } catch (error) {
    console.error(error);
  }
};

const toggleMode = () => {
  authStore.setMode(isRegisterMode.value ? "login" : "register");
};

const clearMessages = () => {
  localError.value = null;
  authStore.clearError();
};
</script>

<template>
  <section class="auth-container py-5">
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-12 col-md-8 col-lg-5">
          <div class="card shadow-sm border-0">
            <div class="card-body p-4 p-md-5">
              <h1 class="h4 mb-3 text-center">Manga Flow Manager</h1>
              <p class="text-muted text-center mb-4">
                {{ isRegisterMode ? "アカウントを作成" : "サインイン" }}
              </p>

              <form @submit.prevent="submit" @keydown.enter="clearMessages">
                <div class="mb-3">
                  <label for="email" class="form-label">メールアドレス</label>
                  <input id="email" v-model="form.email" type="email" class="form-control" placeholder="you@example.com" autocomplete="email" required />
                </div>

                <div class="mb-3">
                  <label for="password" class="form-label">パスワード</label>
                  <input id="password" v-model="form.password" type="password" class="form-control" placeholder="8文字以上" autocomplete="current-password" minlength="6" required />
                </div>

                <div v-if="isRegisterMode" class="mb-3">
                  <label for="confirmPassword" class="form-label">パスワード（確認）</label>
                  <input id="confirmPassword" v-model="form.confirmPassword" type="password" class="form-control" autocomplete="new-password" minlength="6" required />
                </div>

                <div v-if="localError || lastError" class="alert alert-danger" role="alert">
                  {{ localError || lastError }}
                </div>

                <button type="submit" class="btn btn-primary w-100" :disabled="pending">
                  <span v-if="pending" class="spinner-border spinner-border-sm me-2" />
                  {{ isRegisterMode ? "メールアドレスで登録" : "ログイン" }}
                </button>
              </form>

              <div v-if="!isRegisterMode" class="text-center my-3">
                <span class="text-muted">または</span>
              </div>

              <button v-if="!isRegisterMode" type="button" class="btn btn-outline-secondary w-100" :disabled="pending" @click="handleGoogleSignIn">
                <span v-if="pending" class="spinner-border spinner-border-sm me-2" />
                Googleでログイン
              </button>

              <div class="mt-4 text-center">
                <button type="button" class="btn btn-link p-0" :disabled="pending" @click="toggleMode">
                  {{ isRegisterMode ? "既にアカウントをお持ちの方はこちら" : "アカウントをお持ちでない方はこちら" }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.auth-container {
  min-height: calc(100vh - 4rem);
  background: linear-gradient(180deg, rgba(33, 37, 41, 0.12) 0%, rgba(33, 37, 41, 0.03) 100%);
}
</style>
