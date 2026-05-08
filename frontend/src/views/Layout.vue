<script setup lang="ts">
import { computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import type { TabPaneName } from "element-plus";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const activeTab = computed(() =>
  route.name === "chat" ? "chat" : "documents"
);

function onTabChange(name: TabPaneName) {
  if (name === "chat") {
    router.push({ name: "chat" });
  } else {
    router.push({ name: "documents" });
  }
}

function logout() {
  auth.clear();
  router.push({ name: "login" });
}
</script>

<template>
  <el-container class="layout">
    <el-header class="header">
      <div class="brand">文档问答系统</div>
      <el-tabs :model-value="activeTab" type="card" class="nav-tabs" @tab-change="onTabChange">
        <!-- <el-tab-pane label="文档管理" name="documents" />
        <el-tab-pane label="智能问答" name="chat" /> -->
      </el-tabs>
      <div class="spacer" />
      <span class="user">{{ auth.username }}</span>
      <el-button type="primary" link @click="logout">退出</el-button>
    </el-header>
    <el-main class="main">
      <RouterView />
    </el-main>
  </el-container>
</template>

<style scoped>
.layout {
  height: 100%;
}

.header {
  display: flex;
  align-items: center;
  gap: 16px;
  border-bottom: 1px solid var(--el-border-color);
}

.brand {
  font-weight: 600;
  white-space: nowrap;
}

.nav-tabs {
  flex: 0 1 auto;
  min-width: 0;
}

.nav-tabs :deep(.el-tabs__header) {
  margin: 0;
  border-bottom: none;
}

.nav-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}

.nav-tabs :deep(.el-tabs__content) {
  display: none;
}

.nav-tabs :deep(.el-tabs__item) {
  border-radius: 8px 8px 0 0;
  font-weight: 500;
}

.spacer {
  flex: 1;
}

.user {
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.main {
  padding: 16px;
  background: var(--el-bg-color-page);
}
</style>
