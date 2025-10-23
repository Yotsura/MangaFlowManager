import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vueDevTools from "vite-plugin-vue-devtools";

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueDevTools()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vue関連を分離
          'vue-vendor': ['vue', 'vue-router', 'pinia'],

          // Firebase関連を分離（大きなライブラリ）
          'firebase': [
            'firebase/app',
            'firebase/auth',
            'firebase/firestore'
          ],

          // Bootstrap関連を分離
          'bootstrap': ['bootstrap'],

          // Chart.js関連（もし使用している場合）
          // 'chart': ['chart.js'],
        },
      },
    },
    // チャンクサイズ警告の閾値を調整（デフォルト500kB → 1000kB）
    // 注: 手動チャンク分割により、個別チャンクは500kB以下になるはず
    chunkSizeWarningLimit: 1000,
  },
});
