<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const isMobile = ref(false);
let mq: MediaQueryList | null = null;

function updateMq() {
  isMobile.value =
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 768px)").matches;
}

onMounted(() => {
  updateMq();
  mq = window.matchMedia("(max-width: 768px)");
  mq.addEventListener("change", updateMq);
});

onUnmounted(() => {
  mq?.removeEventListener("change", updateMq);
});

const pageTitle = computed(
  () => (route.meta.title as string) || "工作台"
);

const navItems = [
  { path: "/dashboard", name: "dashboard", label: "仪表盘", short: "概览" },
  { path: "/documents", name: "documents", label: "文档", short: "文档" },
  { path: "/chat", name: "chat", label: "问答", short: "问答" },
] as const;

function go(path: string) {
  router.push(path);
}

function logout() {
  auth.clear();
  router.push({ name: "login" });
}
</script>

<template>
  <el-container class="nm-layout" :class="{ 'nm-layout--mobile': isMobile }">
    <el-aside v-if="!isMobile" width="232px" class="nm-aside">
      <div class="nm-brand nm-raised">
        <div class="nm-brand-mark" aria-hidden="true" />
        <div class="nm-brand-text">
          <span class="nm-brand-title">文档问答</span>
          <span class="nm-brand-sub">知识库</span>
        </div>
      </div>
      <nav class="nm-nav">
        <button
          v-for="item in navItems"
          :key="item.path"
          type="button"
          class="nm-nav-btn"
          :class="{ 'nm-nav-btn--active': route.name === item.name }"
          @click="go(item.path)"
        >
          {{ item.label }}
        </button>
      </nav>
    </el-aside>

    <el-container class="nm-main-col">
      <el-header class="nm-topbar nm-raised">
        <span class="nm-topbar-title">{{ pageTitle }}</span>
        <div class="nm-topbar-actions">
          <span class="nm-user">{{ auth.username }}</span>
          <button type="button" class="nm-icon-btn nm-raised-sm" @click="logout">
            退出
          </button>
        </div>
      </el-header>
      <el-main class="nm-main" :class="{ 'nm-main--mobile': isMobile }">
        <RouterView />
      </el-main>
    </el-container>

    <nav v-if="isMobile" class="nm-tabbar nm-raised" aria-label="主导航">
      <button
        v-for="item in navItems"
        :key="item.path"
        type="button"
        class="nm-tabbar-btn"
        :class="{ 'nm-tabbar-btn--active': route.name === item.name }"
        @click="go(item.path)"
      >
        <span class="nm-tabbar-dot" aria-hidden="true" />
        <span>{{ item.short }}</span>
      </button>
    </nav>
  </el-container>
</template>

<style scoped>
.nm-layout {
  height: 100%;
  min-height: 100dvh;
  background: transparent;
}

.nm-layout--mobile {
  flex-direction: column;
  padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px));
}

.nm-raised {
  box-shadow: var(--nm-raise);
  border-radius: var(--nm-radius-md);
  background: linear-gradient(145deg, var(--nm-surface-2), var(--nm-surface));
}

.nm-raised-sm {
  box-shadow: var(--nm-raise-sm);
  border-radius: var(--nm-radius-sm);
  background: linear-gradient(145deg, var(--nm-surface-2), var(--nm-surface));
}

.nm-aside {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px 14px;
  margin: 16px 0 16px 16px;
  border-radius: var(--nm-radius-lg);
  background: linear-gradient(160deg, #f0f3fa, #e8ecf4);
  box-shadow: var(--nm-raise);
  height: calc(100dvh - 32px);
  max-height: calc(100dvh - 32px);
  box-sizing: border-box;
}

.nm-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 14px;
}

.nm-brand-mark {
  width: 40px;
  height: 40px;
  border-radius: 14px;
  background: linear-gradient(145deg, #ddd2f0, var(--nm-primary));
  box-shadow: var(--nm-raise-sm);
}

.nm-brand-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.nm-brand-title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--nm-text);
}

.nm-brand-sub {
  font-size: 11px;
  color: var(--nm-text-soft);
  letter-spacing: 0.06em;
}

.nm-nav {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
}

.nm-nav-btn {
  appearance: none;
  border: none;
  cursor: pointer;
  text-align: left;
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--nm-text);
  border-radius: var(--nm-radius-sm);
  background: linear-gradient(145deg, var(--nm-surface-2), var(--nm-surface));
  box-shadow: var(--nm-raise-sm);
  transition: box-shadow 0.15s ease, transform 0.1s ease;
}

.nm-nav-btn:hover {
  filter: brightness(1.02);
}

.nm-nav-btn:active {
  box-shadow: var(--nm-press);
  transform: scale(0.99);
}

.nm-nav-btn--active {
  color: #fff;
  background: linear-gradient(145deg, #d4caeb, var(--nm-primary));
  box-shadow: var(--nm-raise-sm), 0 0 0 1px rgba(255, 255, 255, 0.35);
}

.nm-main-col {
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.nm-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 16px 16px 0;
  padding: 12px 18px;
  height: auto !important;
  min-height: 52px;
}

.nm-topbar-title {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--nm-text);
}

.nm-topbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nm-user {
  font-size: 13px;
  color: var(--nm-text-soft);
}

.nm-icon-btn {
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  color: var(--nm-text);
  cursor: pointer;
  border: none;
  transition: box-shadow 0.15s ease;
}

.nm-icon-btn:active {
  box-shadow: var(--nm-press);
}

.nm-main {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 16px 18px 24px;
  -webkit-overflow-scrolling: touch;
}

.nm-main--mobile {
  padding: 12px 14px 16px;
}

.nm-tabbar {
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: calc(10px + env(safe-area-inset-bottom, 0px));
  z-index: 2100;
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 8px 6px;
  border-radius: var(--nm-radius-lg);
  background: linear-gradient(145deg, var(--nm-surface-2), var(--nm-surface));
}

.nm-tabbar-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 4px;
  border: none;
  background: transparent;
  font-size: 11px;
  font-weight: 600;
  color: var(--nm-text-soft);
  cursor: pointer;
  border-radius: var(--nm-radius-sm);
  transition: color 0.15s ease, background 0.15s ease;
}

.nm-tabbar-btn--active {
  color: var(--nm-primary-deep);
  background: rgba(255, 255, 255, 0.45);
  box-shadow: var(--nm-inset);
}

.nm-tabbar-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.35;
}

.nm-tabbar-btn--active .nm-tabbar-dot {
  opacity: 0.9;
}
</style>
