<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  Odometer,
  FolderOpened,
  ChatDotRound,
  Menu as MenuIcon,
} from "@element-plus/icons-vue";
import { useAuthStore } from "../stores/auth";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const sideOpen = ref(false);

const titleMap: Record<string, string> = {
  dashboard: "仪表盘",
  documents: "文档管理",
  chat: "智能问答",
};

const pageTitle = computed(
  () => titleMap[String(route.name)] || "工作台"
);

function logout() {
  auth.clear();
  router.push({ name: "login" });
}

function closeSide() {
  sideOpen.value = false;
}
</script>

<template>
  <div class="layout-root">
    <div
      v-show="sideOpen"
      class="side-mask"
      aria-hidden="true"
      @click="closeSide"
    />

    <aside :class="['side', { 'side--open': sideOpen }]">
      <div class="side-brand">
        <span class="side-logo" aria-hidden="true" />
        <div class="side-brand-text">
          <span class="side-title">制度文档问答</span>
          <span class="side-tag">管理后台</span>
        </div>
      </div>

      <el-menu
        :default-active="route.path"
        router
        class="side-menu"
        @select="closeSide"
      >
        <el-menu-item index="/dashboard">
          <el-icon><Odometer /></el-icon>
          <span>仪表盘</span>
        </el-menu-item>
        <el-menu-item index="/documents">
          <el-icon><FolderOpened /></el-icon>
          <span>文档管理</span>
        </el-menu-item>
        <el-menu-item index="/chat">
          <el-icon><ChatDotRound /></el-icon>
          <span>智能问答</span>
        </el-menu-item>
      </el-menu>

      <div class="side-foot">
        <span class="side-foot-muted">v1.0</span>
      </div>
    </aside>

    <el-container class="layout-main" direction="vertical">
      <el-header class="topbar">
        <div class="topbar-left">
          <el-button
            class="menu-toggle"
            text
            circle
            aria-label="打开菜单"
            @click="sideOpen = !sideOpen"
          >
            <el-icon :size="20"><MenuIcon /></el-icon>
          </el-button>
          <el-breadcrumb separator="/" class="crumb">
            <el-breadcrumb-item :to="{ path: '/dashboard' }">
              工作台
            </el-breadcrumb-item>
            <el-breadcrumb-item>{{ pageTitle }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="topbar-right">
          <span class="user-name">{{ auth.username }}</span>
          <el-button type="primary" size="small" round @click="logout">
            退出
          </el-button>
        </div>
      </el-header>

      <el-main class="main">
        <RouterView />
      </el-main>
    </el-container>
  </div>
</template>

<style scoped>
.layout-root {
  display: flex;
  height: 100%;
  min-height: 100%;
  overflow: hidden;
}

.side-mask {
  display: none;
}

.side {
  flex-shrink: 0;
  width: 232px;
  display: flex;
  flex-direction: column;
  background: var(--adm-side-bg, #111827);
  border-right: 1px solid var(--adm-side-border, rgba(148, 163, 184, 0.08));
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.2);
  z-index: 1002;
}

.side-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 22px 18px 20px;
  border-bottom: 1px solid var(--adm-side-border, rgba(148, 163, 184, 0.08));
}

.side-logo {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, #5a7a9e, #3d5a78);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
}

.side-brand-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.side-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.side-tag {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  letter-spacing: 0.04em;
}

.side-menu {
  flex: 1;
  border-right: none !important;
  padding: 12px 10px;
  background: transparent !important;
}

.side-menu :deep(.el-menu-item) {
  height: 46px;
  line-height: 46px;
  margin-bottom: 4px;
  border-radius: 10px;
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.side-menu :deep(.el-menu-item:hover) {
  background: var(--adm-accent-soft, rgba(107, 143, 184, 0.12)) !important;
  color: var(--el-text-color-primary);
}

.side-menu :deep(.el-menu-item.is-active) {
  background: var(--adm-accent-soft, rgba(107, 143, 184, 0.18)) !important;
  color: var(--el-color-primary);
  font-weight: 600;
  box-shadow: inset 0 0 0 1px rgba(107, 143, 184, 0.25);
}

.side-foot {
  padding: 14px 18px 20px;
  border-top: 1px solid var(--adm-side-border, rgba(148, 163, 184, 0.08));
}

.side-foot-muted {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}

.layout-main {
  flex: 1;
  min-width: 0;
  background: var(--el-bg-color-page);
}

.topbar {
  height: 56px !important;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px 0 12px;
  background: var(--adm-top-bg, rgba(17, 24, 39, 0.92));
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--el-border-color-extra-light);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.03);
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.menu-toggle {
  display: none;
  color: var(--el-text-color-regular);
}

.crumb {
  font-size: 13px;
}

.crumb :deep(.el-breadcrumb__inner.is-link) {
  font-weight: 500;
  color: var(--el-text-color-secondary);
}

.crumb :deep(.el-breadcrumb__item:last-child .el-breadcrumb__inner) {
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
}

.user-name {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.main {
  padding: 20px 22px 28px;
  overflow: auto;
}

@media (max-width: 900px) {
  .menu-toggle {
    display: inline-flex;
  }

  .side {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    transform: translateX(-100%);
    transition: transform 0.26s ease;
  }

  .side--open {
    transform: translateX(0);
  }

  .side-mask {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 1001;
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(2px);
  }

  .main {
    padding: 16px 14px 24px;
  }
}
</style>
