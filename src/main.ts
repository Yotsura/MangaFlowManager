import "./assets/main.css";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";

import { createApp } from "vue";
import { createPinia } from "pinia";

import App from "./App.vue";
import router from "./router";
import { useAuthStore } from "@/stores/auth";

const bootstrap = async () => {
	const app = createApp(App);
	const pinia = createPinia();

	app.use(pinia);
	app.use(router);

	const authStore = useAuthStore(pinia);
	await authStore.ensureInitialized();

	await router.isReady();
	app.mount("#app");
};

bootstrap().catch((error) => {
	 
	console.error("アプリケーションの初期化に失敗しました", error);
});
