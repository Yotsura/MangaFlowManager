<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'vue-router';

const isCollapsed = ref(false);
const authStore = useAuthStore();
const { displayName } = storeToRefs(authStore);
const router = useRouter();

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value;
};

const handleLogout = async () => {
  try {
    await authStore.logout();
    await router.push({ name: 'login' });
  } catch (error) {
    console.error(error);
  }
};

const menuItems = [
  { path: '/', icon: 'bi-house-door', label: 'ホーム' },
  { path: '/works', icon: 'bi-book', label: '作品管理' },
  { path: '/calendar', icon: 'bi-calendar3', label: 'カレンダー' },
  { path: '/settings', icon: 'bi-gear', label: '設定' },
  { path: '/about', icon: 'bi-info-circle', label: 'アプリについて' },
];
</script>

<template>
  <!-- デスクトップ: 左側固定ナビゲーション -->
  <nav
    class="app-navbar d-none d-lg-flex flex-column bg-dark"
    :class="{ collapsed: isCollapsed }"
  >
    <!-- ヘッダー部分: タイトルと折りたたみボタン -->
    <div class="navbar-header d-flex align-items-center">
      <RouterLink 
        class="navbar-brand text-light mb-0 flex-grow-1" 
        to="/"
        :class="{ 'text-center': isCollapsed }"
      >
        <span v-if="!isCollapsed">Manga Flow Manager</span>
        <span v-else>MFM</span>
      </RouterLink>
      <button
        class="collapse-toggle-btn btn btn-dark border-0 p-2"
        @click="toggleCollapse"
        :title="isCollapsed ? '展開' : '折りたたむ'"
      >
        <i class="bi" :class="isCollapsed ? 'bi-chevron-right' : 'bi-chevron-left'"></i>
      </button>
    </div>

    <!-- メニュー項目 -->
    <div class="nav-items flex-grow-1">
      <RouterLink
        v-for="item in menuItems"
        :key="item.path"
        :to="item.path"
        class="nav-item"
      >
        <i class="bi" :class="item.icon"></i>
        <span v-if="!isCollapsed" class="nav-label">{{ item.label }}</span>
      </RouterLink>
    </div>

    <!-- ログアウトボタン -->
    <div class="navbar-footer">
      <div v-if="!isCollapsed" class="user-info text-light small px-3 py-2">
        <i class="bi bi-person-circle me-2"></i>
        <span>{{ displayName || 'ログイン中' }}</span>
      </div>
      <button 
        type="button" 
        class="logout-btn btn btn-dark border-0 w-100"
        :class="{ 'text-center': isCollapsed }"
        @click="handleLogout"
        :title="isCollapsed ? 'ログアウト' : ''"
      >
        <i class="bi bi-box-arrow-right"></i>
        <span v-if="!isCollapsed" class="ms-2">ログアウト</span>
      </button>
    </div>
  </nav>

  <!-- スマホ: 下部固定ナビゲーション -->
  <nav class="mobile-navbar d-flex d-lg-none bg-dark">
    <RouterLink
      v-for="item in menuItems.slice(0, 4)"
      :key="item.path"
      :to="item.path"
      class="mobile-nav-item"
    >
      <i class="bi" :class="item.icon"></i>
      <span class="mobile-nav-label">{{ item.label }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
/* デスクトップ: 左側固定ナビゲーション */
.app-navbar {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: 240px;
  transition: width 0.3s ease;
  z-index: 1030;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
  overflow-y: auto;
  overflow-x: hidden;
}

.app-navbar.collapsed {
  width: 70px;
}

/* ヘッダー部分 */
.navbar-header {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  min-height: 56px;
}

.navbar-brand {
  font-size: 1.1rem;
  font-weight: 600;
  text-decoration: none;
  padding: 0;
  transition: all 0.3s;
}

.collapsed .navbar-brand {
  font-size: 0.85rem;
  padding: 0;
}

.collapse-toggle-btn {
  padding: 0.375rem 0.5rem !important;
  transition: background-color 0.2s;
  cursor: pointer;
}

.collapse-toggle-btn:hover {
  background-color: rgba(255, 255, 255, 0.1) !important;
}

/* メニュー項目 */
.nav-items {
  display: flex;
  flex-direction: column;
  padding: 0.5rem 0;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 1rem 1.5rem;
  color: rgba(255, 255, 255, 0.75);
  text-decoration: none;
  transition: all 0.2s;
  white-space: nowrap;
}

.collapsed .nav-item {
  justify-content: center;
  padding: 1rem 0;
}

.nav-item i {
  font-size: 1.25rem;
  min-width: 1.5rem;
}

.nav-label {
  margin-left: 1rem;
  font-size: 0.95rem;
  transition: opacity 0.2s;
}

.collapsed .nav-label {
  opacity: 0;
  width: 0;
  overflow: hidden;
}

.nav-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.nav-item.router-link-active {
  background-color: rgba(13, 110, 253, 0.25);
  color: #fff;
  border-left: 4px solid #0d6efd;
}

.collapsed .nav-item.router-link-active {
  border-left: none;
  border-right: 4px solid #0d6efd;
}

/* フッター部分（ログアウト） */
.navbar-footer {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  margin-top: auto;
}

.user-info {
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.logout-btn {
  padding: 1rem !important;
  color: rgba(255, 255, 255, 0.75);
  transition: all 0.2s;
  text-align: left;
}

.collapsed .logout-btn {
  padding: 1rem 0 !important;
}

.logout-btn:hover {
  background-color: rgba(220, 53, 69, 0.2) !important;
  color: #fff !important;
}

.logout-btn i {
  font-size: 1.25rem;
}

.collapsed .logout-btn i {
  font-size: 1.5rem;
}

.collapsed .nav-item {
  justify-content: center;
  padding: 1rem 0;
}

.nav-item i {
  font-size: 1.25rem;
  min-width: 1.5rem;
}

.nav-label {
  margin-left: 1rem;
  font-size: 0.95rem;
  transition: opacity 0.2s;
}

.collapsed .nav-label {
  opacity: 0;
  width: 0;
  overflow: hidden;
}

.nav-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.nav-item.router-link-active {
  background-color: rgba(13, 110, 253, 0.25);
  color: #fff;
  border-left: 4px solid #0d6efd;
}

.collapsed .nav-item.router-link-active {
  border-left: none;
  border-right: 4px solid #0d6efd;
}

/* スマホ: 下部固定ナビゲーション */
.mobile-navbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 65px;
  z-index: 1020;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.15);
  padding: 0;
}

.mobile-nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.75);
  text-decoration: none;
  padding: 0.5rem;
  transition: all 0.2s;
  border-top: 3px solid transparent;
}

.mobile-nav-item i {
  font-size: 1.5rem;
  margin-bottom: 0.25rem;
}

.mobile-nav-label {
  font-size: 0.65rem;
  line-height: 1;
  font-weight: 500;
}

.mobile-nav-item:hover,
.mobile-nav-item:active {
  background-color: rgba(255, 255, 255, 0.1);
}

.mobile-nav-item.router-link-active {
  color: #fff;
  background-color: rgba(13, 110, 253, 0.15);
  border-top-color: #0d6efd;
}

.mobile-nav-item.router-link-active i {
  color: #0d6efd;
}
</style>
