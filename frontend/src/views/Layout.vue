<script setup lang="ts">
import { useRouter, useRoute } from "vue-router";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

function logout() {
  auth.clear();
  router.push({ name: "login" });
}
</script>

<template>
  <el-container class="layout">
    <el-header class="header">
      <div class="brand">制度文档问答</div>
      <el-menu
        :default-active="route.path"
        mode="horizontal"
        router
        class="menu"
      >
        <el-menu-item index="/documents">文档管理</el-menu-item>
        <el-menu-item index="/chat">智能问答</el-menu-item>
      </el-menu>
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
.menu {
  flex: 0 1 auto;
  border-bottom: none;
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
