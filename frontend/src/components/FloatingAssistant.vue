<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import RobotIcon from "./RobotIcon.vue";
import ChatPanel from "./ChatPanel.vue";

const route = useRoute();
const drawerVisible = ref(false);

/** 独立「智能问答」页已有完整面板，隐藏悬浮球避免重复 */
const showFab = computed(() => route.name !== "chat");

watch(
  () => route.name,
  (name) => {
    if (name === "chat") drawerVisible.value = false;
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
  color: var(--nm-primary-deep, #9b8cc4);
  background: linear-gradient(145deg, #f4f6fb, #e4e9f2);
  box-shadow: var(--nm-raise);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.fab-assistant:hover {
  transform: scale(1.04);
  filter: brightness(1.02);
}

.fab-assistant:active {
  transform: scale(0.97);
  box-shadow: var(--nm-press);
}

@media (max-width: 768px) {
  .fab-assistant {
    right: 16px;
    bottom: calc(72px + env(safe-area-inset-bottom, 0px));
  }
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
  border-radius: var(--nm-radius-lg, 22px) 0 0 var(--nm-radius-lg, 22px);
  overflow: hidden;
  box-shadow: -12px 0 40px rgba(120, 130, 155, 0.18);
}
</style>
