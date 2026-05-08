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

    <el-drawer v-model="drawerVisible" direction="rtl" size="min(440px, 100vw)" :with-header="false"
      :destroy-on-close="false" append-to-body class="assistant-drawer-wrap" body-class="assistant-drawer-body">
      <ChatPanel variant="drawer" />
    </el-drawer>
  </Teleport>
</template>

<style scoped>
.fab-assistant {
  position: fixed;
  right: 20px;
  bottom: 24px;
  z-index: 2000;
  width: 56px;
  height: 56px;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  color: #fff;
  background: linear-gradient(145deg, var(--el-color-primary), var(--el-color-primary-dark-2));
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.fab-assistant:hover {
  transform: scale(1.06);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.22);
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
</style>
