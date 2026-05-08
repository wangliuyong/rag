<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import RobotIcon from "./RobotIcon.vue";
import ChatPanel from "./ChatPanel.vue";

const route = useRoute();
const drawerVisible = ref(false);

/** 问答页与仪表盘大屏隐藏悬浮球 */
const showFab = computed(
  () => route.name !== "chat" && route.name !== "dashboard"
);

watch(
  () => route.name,
  (name) => {
    if (name === "chat" || name === "dashboard") drawerVisible.value = false;
  }
);
</script>

<template>
  <Teleport to="body">
    <button v-if="showFab" type="button" class="fab-assistant" aria-label="打开深迪小助手" @click="drawerVisible = true">
      <RobotIcon :size="30" />
    </button>

    <el-drawer
      v-model="drawerVisible"
      direction="rtl"
      size="min(440px, 100vw)"
      :with-header="false"
      :destroy-on-close="false"
      append-to-body
      class="assistant-drawer-wrap assistant-drawer-shell"
      body-class="assistant-drawer-body"
    >
      <ChatPanel variant="drawer" />
    </el-drawer>
  </Teleport>
</template>

<style scoped>
.fab-assistant {
  position: fixed;
  right: 22px;
  bottom: 26px;
  z-index: 2000;
  width: 58px;
  height: 58px;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  color: #fff;
  background: linear-gradient(
    145deg,
    var(--el-color-primary),
    var(--el-color-primary-dark-2)
  );
  box-shadow:
    0 0 0 3px color-mix(in srgb, var(--el-bg-color) 85%, transparent),
    0 6px 22px rgba(15, 23, 42, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.fab-assistant:hover {
  transform: scale(1.05);
  box-shadow:
    0 0 0 3px color-mix(in srgb, var(--el-bg-color) 85%, transparent),
    0 10px 28px rgba(15, 23, 42, 0.22);
}

.fab-assistant:active {
  transform: scale(0.98);
}
</style>

<style>
/* 抽屉内铺满，无默认 padding */
.assistant-drawer-body {
  padding: 0 !important;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.assistant-drawer-wrap .el-drawer__body {
  padding: 0;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.assistant-drawer-shell.el-drawer.rtl {
  border-radius: 16px 0 0 16px;
  overflow: hidden;
  box-shadow: -16px 0 48px rgba(15, 23, 42, 0.14);
}
</style>
